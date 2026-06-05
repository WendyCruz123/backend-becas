import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

@Controller('files')
export class FilesController {
  @Post('requisitos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'requisitos');
        ensureDir(dir);
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname).toLowerCase());
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowed = [
        'application/pdf',
        'application/msword', // .doc
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      ];

      if (!allowed.includes(file.mimetype)) {
        return cb(
          new BadRequestException('Solo se permite PDF o Word (.doc, .docx)') as any,
          false
        );
      }

      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  }))
  uploadRequisitoFile(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo requerido (PDF o Word)');
    }

    const url = `/uploads/requisitos/${file.filename}`;
    return { url };
  }
}
