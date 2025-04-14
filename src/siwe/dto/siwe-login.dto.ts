import { IsNotEmpty, IsString } from 'class-validator';

export class SiweLoginDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}