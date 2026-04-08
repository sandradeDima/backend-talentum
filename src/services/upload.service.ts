import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppError } from '../errors/appError';
import { env } from '../config/env';
import type { UploadCompanyLogoDto } from '../dto/upload.dto';

const MIME_EXTENSION: Record<UploadCompanyLogoDto['mimeType'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const hasValidSignature = (buffer: Buffer, mimeType: UploadCompanyLogoDto['mimeType']) => {
  if (mimeType === 'image/png') {
    return (
      buffer.length > 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  if (mimeType === 'image/jpeg') {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/gif') {
    return (
      buffer.length > 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46
    );
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.length > 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  return false;
};

export class UploadService {
  private readonly companyLogoDir = path.resolve(env.UPLOAD_DIR, 'company-logos');

  constructor() {
    fs.mkdirSync(this.companyLogoDir, { recursive: true });
  }

  saveCompanyLogo(payload: UploadCompanyLogoDto) {
    let buffer: Buffer;

    try {
      buffer = Buffer.from(payload.base64, 'base64');
    } catch {
      throw new AppError('Contenido base64 inválido', 400, 'INVALID_BASE64_IMAGE');
    }

    if (!buffer || buffer.length === 0) {
      throw new AppError('Imagen inválida', 400, 'EMPTY_IMAGE_BUFFER');
    }

    const maxBytes = env.MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (buffer.length > maxBytes) {
      throw new AppError(
        `La imagen supera el límite de ${env.MAX_UPLOAD_SIZE_MB}MB`,
        413,
        'IMAGE_TOO_LARGE'
      );
    }

    if (!hasValidSignature(buffer, payload.mimeType)) {
      throw new AppError('Formato de imagen inválido', 400, 'INVALID_IMAGE_SIGNATURE');
    }

    const extension = MIME_EXTENSION[payload.mimeType];
    const safeName = `company-logo-${Date.now()}-${randomUUID()}.${extension}`;
    const targetPath = path.join(this.companyLogoDir, safeName);

    fs.writeFileSync(targetPath, buffer, { flag: 'wx' });

    return {
      logoUrl: `/uploads/company-logos/${safeName}`,
      fileSize: buffer.length
    };
  }
}
