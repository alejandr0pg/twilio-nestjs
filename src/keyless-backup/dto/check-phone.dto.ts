import { IsNotEmpty, IsString } from 'class-validator';

export class CheckPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  wallet: string;
}

export class CheckPhoneResponseDto {
  exists: boolean;
  walletAddress?: string;
  phone?: string;
}
