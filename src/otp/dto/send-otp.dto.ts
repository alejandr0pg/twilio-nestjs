import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'El número de teléfono debe tener formato internacional (ej: +34612345678)',
  })
  phone: string;
}
