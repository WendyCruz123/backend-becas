import { IsEmail, IsNotEmpty, IsString, IsInt, IsOptional, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsInt()
  @IsNotEmpty()
  persona: number; // corresponde al ID_persona

  @IsArray()
  @IsOptional()
  roles?: string[]; // puedes omitir si se asigna por defecto en el backend
}
