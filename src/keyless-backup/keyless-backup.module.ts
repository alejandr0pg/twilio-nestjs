import { Module } from '@nestjs/common';
import { KeylessBackupController } from './keyless-backup.controller';
import { KeylessBackupService } from './keyless-backup.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [KeylessBackupController],
  providers: [KeylessBackupService],
})
export class KeylessBackupModule {}
