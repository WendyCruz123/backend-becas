import { Injectable, Logger } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

type WaStatus =
  | 'DISCONNECTED'
  | 'INITIALIZING'
  | 'SCAN_QR'
  | 'AUTHENTICATED'
  | 'READY'
  | 'AUTH_FAILURE'
  | 'ERROR';

@Injectable()
export class WhatsAppService {
  private readonly log = new Logger(WhatsAppService.name);

  private client: Client | null = null;
  private ready = false;
  private currentQR: string | null = null;
  private currentQRImage: string | null = null;
  private lastError: string | null = null;
  private lastInfo: any = null;
  private status: WaStatus = 'DISCONNECTED';

  private initializing = false;

  private getClientId() {
    return process.env.WHATSAPP_CLIENT_ID || 'becas';
  }

  private getAuthPath() {
    return (
      process.env.WHATSAPP_SESSION_PATH ||
      path.join(process.cwd(), '.wwebjs_auth')
    );
  }

  private getSessionPath() {
    return path.join(this.getAuthPath(), `session-${this.getClientId()}`);
  }

  async startAuthentication() {
    if (this.client) {
      this.log.warn('Cliente ya existe, evitando reinicialización.');
      return {
        ok: true,
        message: 'WhatsApp ya está inicializado.',
        status: this.getStatus(),
      };
    }

    if (this.status === 'READY') {
      return {
        ok: true,
        message: 'WhatsApp ya está autenticado.',
        status: this.getStatus(),
      };
    }

    if (this.initializing) {
      return {
        ok: true,
        message: 'WhatsApp ya se está inicializando.',
        status: this.getStatus(),
      };
    }

    await this.initClient();

    return {
      ok: true,
      message: 'Inicialización de WhatsApp iniciada.',
      status: this.getStatus(),
    };
  }

  private async initClient() {
    this.initializing = true;
    this.ready = false;
    this.currentQR = null;
    this.currentQRImage = null;
    this.lastError = null;
    this.status = 'INITIALIZING';

    const clientId = this.getClientId();

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId,
        dataPath: this.getAuthPath(),
      }),
      authTimeoutMs: 120000,
      qrMaxRetries: 5,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 10000,
    });

    this.bindEvents(this.client);

    try {
      await this.client.initialize();
      this.log.log('Inicialización de WhatsApp lanzada.');
    } catch (error: any) {
  this.initializing = false;
  this.status = 'ERROR';
  this.lastError = error?.message || String(error);

  try {
    await this.client?.destroy();
  } catch {}

  this.client = null;

  this.log.error(`Error inicializando WhatsApp: ${this.lastError}`);
}
  }

  private bindEvents(client: Client) {
    client.on('qr', async (qr) => {
      this.status = 'SCAN_QR';
      this.currentQR = qr;
      this.currentQRImage = await qrcode.toDataURL(qr);
      this.log.log('QR generado.');
    });

    client.on('authenticated', () => {
      this.status = 'AUTHENTICATED';
      this.log.log('Autenticado, esperando READY...');
    });

    client.on('ready', () => {
      this.ready = true;
      this.initializing = false;
      this.status = 'READY';
      this.currentQR = null;
      this.currentQRImage = null;
      this.log.log('WhatsApp listo.');
    });

    client.on('auth_failure', (msg) => {
      this.ready = false;
      this.initializing = false;
      this.status = 'AUTH_FAILURE';
      this.lastError = msg;
      this.log.error(`Auth failure: ${msg}`);
    });

    client.on('disconnected', (reason) => {
      this.ready = false;
      this.initializing = false;
      this.status = 'DISCONNECTED';
      this.client = null;
      this.log.warn(`Desconectado: ${reason}`);
    });
  }

  private async esperarReady(timeout = 60000) {
    const start = Date.now();

    while (!this.ready || this.status !== 'READY') {
      if (Date.now() - start > timeout) return false;
      await new Promise((res) => setTimeout(res, 500));
    }

    return true;
  }

  async sendMessage(rawPhone: string, message: string): Promise<boolean> {
    if (!this.client) {
      this.log.warn('WhatsApp no inicializado.');
      return false;
    }

    if (this.status !== 'READY') {
      this.log.warn('WhatsApp no está listo.');
      return false;
    }

    const timeout = Number(process.env.WHATSAPP_READY_TIMEOUT_MS || 60000);
    const listo = await this.esperarReady(timeout);
    if (!listo) return false;

    const digits = rawPhone.replace(/\D/g, '');
    const prefix = process.env.WHATSAPP_COUNTRY_PREFIX || '591';
    const msisdn = digits.startsWith(prefix) ? digits : prefix + digits;
    const jid = `${msisdn}@c.us`;

    try {
      const exists = await this.client.isRegisteredUser(jid);

      if (!exists) {
        this.log.warn(`Número no registrado en WhatsApp: ${msisdn}`);
        return false;
      }

      await this.client.sendMessage(jid, message);

      // anti bloqueo
      await new Promise((res) => setTimeout(res, 2000));

      this.log.log(`Enviado a ${msisdn}`);
      return true;
    } catch (e: any) {
      this.log.error(`Error enviando: ${e.message}`);
      return false;
    }
  }

  getStatus() {
    return {
      status: this.status,
      ready: this.ready,
      hasQR: !!this.currentQRImage,
      error: this.lastError,
    };
  }

  async getQR() {
    return {
      qrImage: this.currentQRImage,
      status: this.status,
    };
  }

  async logout() {
    try {
      await this.client?.logout();
      await this.client?.destroy();
    } catch {}

    this.client = null;
    this.ready = false;
    this.status = 'DISCONNECTED';

    return { ok: true };
  }

  async resetSession() {
    await this.logout();

    const sessionPath = this.getSessionPath();

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    return { ok: true };
  }
  async onModuleDestroy() {
  try {
    await this.client?.destroy();
  } catch {}
}
}