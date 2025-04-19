import { IsNotEmpty, IsString } from 'class-validator';

export class CreateKeylessBackupDto {
  @IsString()
  @IsNotEmpty()
  encryptedMnemonic: string;

  @IsString()
  @IsNotEmpty()
  encryptionAddress: string;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  phone: string;
}
