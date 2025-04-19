import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class KeylessBackupDto {
  @IsString()
  @IsNotEmpty()
  encryptedMnemonic: string;

  @IsString()
  @IsNotEmpty()
  encryptionAddress: string;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  flow?: string;

  @IsString()
  @IsOptional()
  origin?: string;
}
