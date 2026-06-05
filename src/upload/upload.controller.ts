import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

function filenameGenerator(_req: any, file: Express.Multer.File, cb: any) {
  const random = Math.random().toString(36).slice(2, 10);
  const ext = extname(file.originalname) || '.jpg';
  cb(null, `${Date.now()}_${random}${ext}`);
}

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, process.env.UPLOAD_DIR ?? 'uploads');
        },
        filename: filenameGenerator,
      }),
      fileFilter: (_req, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
        if (!ok) return cb(new BadRequestException('Solo JPG/PNG'), false);
        cb(null, true);
      },
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const publicBase = process.env.PUBLIC_BASE_URL ?? 'http://localhost:5000';
    const url = `${publicBase}/uploads/${file.filename}`;
    return {
      ok: true,
      filename: file.filename,
      mime: file.mimetype,
      size: file.size,
      url,
    };
  }
}
