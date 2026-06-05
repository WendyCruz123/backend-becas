import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsDateString,
  Matches,
  Validate,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { MinAgeValidator } from 'src/common/validators/min-age.validator';

export class CreatePersonaDto {
  @IsString()
  @IsNotEmpty({ message: 'El campo CI es obligatorio' })
  @Matches(/^\d+$/, { message: 'El CI debe contener solo números sin espacios' })
  ci: string;

  @IsString()
  @IsNotEmpty({ message: 'El campo expedido es obligatorio' })
  expedido: string;

  @IsString()
  @IsNotEmpty({ message: 'El campo nombre es obligatorio' })
  nombre: string;

  @IsString()
  apellido_paterno?: string;

  @IsString()
  apellido_materno?: string;

  @IsOptional()
  @IsString()
  apellido_casado?: string;

  @IsString()
  @Matches(/^[^\s]+$/, { message: 'no se permite espacios innecesarios' })
  @IsNotEmpty({ message: 'El campo género es obligatorio' })
  genero: string;

  @IsString()
  direccion?: string;

  @IsEmail()
  @Matches(/^[^\s]+$/, { message: 'no se permite espacios innecesarios' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  correo_electronico: string;

  @IsString()
  @IsNotEmpty({ message: 'El celular es obligatorio' })
  @Matches(/^\d+$/, { message: 'El celular debe ser numérico' })
  celular: string;

  @IsDateString({}, { message: 'La fecha de nacimiento no es válida' })
  @Validate(MinAgeValidator)
  fecha_nacimiento: string;

  @IsString()
  @IsNotEmpty({ message: 'El estado civil es obligatorio' })
  estado_civil: string;
  
  @IsOptional()
  @IsInt({ message: 'El RU debe ser numérico' })
  @Min(1, { message: 'El RU debe ser mayor que 0' })
  ru?: number;
  // 🔹 DATOS ACADÉMICOS (NUEVO)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  promedio?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numero_Materias_Reprobadas?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  año_ingreso?: number;

  @IsOptional()
  semestre?: boolean;
}
