import { IsNotEmpty, IsString } from 'class-validator';

export class KeylessBackupDto {
  @IsString()
  @IsNotEmpty()
  encryptedMnemonic: string;

  @IsString()
  @IsNotEmpty()
  encryptionAddress: string;
}