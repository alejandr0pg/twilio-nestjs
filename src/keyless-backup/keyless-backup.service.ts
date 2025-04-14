import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { KeylessBackupDto } from './dto/keyless-backup.dto';

@Injectable()
export class KeylessBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    clientId: string,
    createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    const { encryptedMnemonic, encryptionAddress, token } =
      createKeylessBackupDto;

    const existingBackup = await this.prisma.keylessBackup.findFirst({
      where: { clientId },
    });

    if (existingBackup) {
      // Update the existing backup
      const updatedBackup = await this.prisma.keylessBackup.update({
        where: { id: existingBackup.id },
        data: {
          encryptedMnemonic,
          encryptionAddress,
          token,
        },
      });
      return updatedBackup;
    }

    // Create a new backup
    const newBackup = await this.prisma.keylessBackup.create({
      data: {
        clientId,
        encryptedMnemonic,
        encryptionAddress,
        token,
      },
    });

    return newBackup;
  }

  async findOne(clientId: string): Promise<KeylessBackupDto | null> {
    const backup = await this.prisma.keylessBackup.findFirst({
      where: { clientId: clientId },
    });

    if (!backup) {
      return null;
    }

    return backup;
  }

  async remove(clientId: string): Promise<void> {
    const backup = await this.prisma.keylessBackup.findFirst({
      where: { clientId: clientId },
    });

    if (!backup) {
      throw new NotFoundException(
        `Keyless backup not found for client with ID: ${clientId}`,
      );
    }

    await this.prisma.keylessBackup.delete({
      where: { id: backup.id },
    });
  }
}
