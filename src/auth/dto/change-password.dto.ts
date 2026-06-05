// src/auth/dto/change-password.dto.ts
import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString({ message: 'currentPassword debe ser string' })
  currentPassword?: string;

  @IsString({ message: 'newPassword debe ser string' })
  @MinLength(8,  { message: 'La nueva contraseña debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La nueva contraseña no debe exceder 72 caracteres' })
  newPassword!: string;

  // Si quieres validar coincidencia, añade confirmPassword opcional.
}
