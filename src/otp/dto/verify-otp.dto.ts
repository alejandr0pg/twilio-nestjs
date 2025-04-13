import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'El número de teléfono debe tener formato internacional (ej: +34612345678)',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'El código OTP debe tener 6 dígitos' })
  @Matches(/^\d+$/, { message: 'El código OTP debe contener solo dígitos' })
  code: string;
}