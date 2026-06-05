import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsuarioModule } from './usuario/usuario.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './auth/guards/jwt.strategy';
import { PersonaModule } from './persona/persona.module';
import { join } from 'path';
import { PanoramasModule } from './panoramas/panoramas.module';
import { HotspotsModule } from './hotspots/hotspots.module';
import { UploadModule } from './upload/upload.module';
import { BecasModule } from './becas/becas.module';
import { RequisitosModule } from './requisitos/requisitos.module';
import { OficinasModule } from './oficinas/oficinas.module';
import { PostulacionesModule } from './postulaciones/postulaciones.module';
import { GrupoRolModule } from './grupo-rol/grupo-rol.module';
import { CargoAdministrativoModule } from './cargo-administrativo/cargo-administrativo.module';
import { GrupoUsuarioModule } from './grupo-usuario/grupo-usuario.module';
import { FilesModule } from './files/files.module';
import { SecurityModule } from './security/security.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { EstudianteModule } from './estudiante/estudiante.module';
import { KardexModule } from './kardex/kardex.module';
import { NotificacionesSistemaModule } from './notificaciones-sistema/notificaciones-sistema.module';
import { Rutas360Module } from './rutas360/rutas360.module';
import { LegalizacionModule } from './legalizacion/legalizacion.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), process.env.UPLOAD_DIR ?? 'uploads'),
      serveRoot: '/uploads', // ⇒ los archivos quedarán en http://localhost:3000/files/<nombre>
    }),
    EstudianteModule,
    GrupoRolModule,
    NotificationsModule,
    WhatsAppModule,
    MailerModule,
    FilesModule,
    SecurityModule,
    CargoAdministrativoModule,
    GrupoUsuarioModule,
    BecasModule,
    RequisitosModule,
    OficinasModule,
    PostulacionesModule,
    PersonaModule,
    PrismaModule,
    PanoramasModule,
    HotspotsModule,
    UploadModule,
    AuthModule, 
    UsuarioModule,
    KardexModule,
    NotificacionesSistemaModule,
    Rutas360Module,
    LegalizacionModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
