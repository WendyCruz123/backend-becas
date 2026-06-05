import { IsBoolean, IsInt, Min, Max, IsOptional } from 'class-validator';
export class CreateEstudianteDto {
  @IsInt({ message: 'El promedio debe ser un número entero' })
  @Min(0, { message: 'El promedio no puede ser menor a 0' })
  @Max(100, { message: 'El promedio no puede superar 100' })
  promedio: number;

  @IsInt({ message: 'Debe indicar la cantidad de materias reprobadas' })
  @Min(0, { message: 'El número de materias reprobadas no puede ser negativo' })
  numero_Materias_Reprobadas: number;

  @IsInt({ message: 'El año de ingreso debe ser un número entero' })
  @Min(2000, { message: 'El año de ingreso no puede ser menor a 2000' })
  año_ingreso: number;

  @IsBoolean({ message: 'El campo semestre debe ser verdadero o falso' })
  semestre: boolean;
  // 👇 NUEVO CAMPO AÑADIDO
  @IsOptional()
  @IsInt({ message: 'El RU debe ser numérico' })
  @Min(1, { message: 'El RU debe ser mayor que 0' })
  ru?: number;
}