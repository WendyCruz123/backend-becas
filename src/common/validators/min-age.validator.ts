import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'MinAge', async: false })
export class MinAgeValidator implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value) return false;

    const birthDate = new Date(value);

    if (isNaN(birthDate.getTime())) return false;

    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 15;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La persona debe tener al menos 15 años.';
  }
}