import { IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';

export class EmergencyRecoveryDto {
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  adminCode: string;
}