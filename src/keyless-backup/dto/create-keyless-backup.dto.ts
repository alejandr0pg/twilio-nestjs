import { IsNotEmpty, IsString } from 'class-validator';

export class CreateKeylessBackupDto {
  @IsString()
  @IsNotEmpty()
  encryptedMnemonic: string;

  @IsString()
  @IsNotEmpty()
  encryptionAddress: string;
}