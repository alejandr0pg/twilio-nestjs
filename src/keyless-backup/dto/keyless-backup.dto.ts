import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class KeylessBackupDto {
  @IsString()
  @IsOptional()
  encryptedMnemonic?: string;

  @IsString()
  @IsOptional()
  encryptionAddress?: string;

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
