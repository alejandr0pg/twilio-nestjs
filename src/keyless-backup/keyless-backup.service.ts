import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { KeylessBackupDto } from './dto/keyless-backup.dto';

@Injectable()
export class KeylessBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    walletAddress: string,
    createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    const { encryptedMnemonic, encryptionAddress } = createKeylessBackupDto;

    const existingBackup = await this.prisma.keylessBackup.findFirst({
      where: { walletAddress },
    });

    if (existingBackup) {
      // Update the existing backup
      const updatedBackup = await this.prisma.keylessBackup.update({
        where: { id: existingBackup.id },
        data: {
          encryptedMnemonic,
          encryptionAddress,
          updatedAt: new Date(),
        },
      });

      return updatedBackup;
    }

    // Create a new backup
    const newBackup = await this.prisma.keylessBackup.create({
      data: {
        walletAddress,
        encryptedMnemonic,
        encryptionAddress,
        status: 'NotStarted',
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

  async linkWalletToPhone(
    phone: string,
    walletAddress: string,
    keyshare: string,
    sessionId: string,
  ) {
    // Verify session
    const session = await this.prisma.siweSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    // Verify if session has expired
    if (new Date() > session.expirationTime) {
      throw new UnauthorizedException('Session expired');
    }

    // Verify OTP record with keyshare
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        keyshare,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpRecord) {
      throw new UnauthorizedException('Invalid keyshare or phone number');
    }

    // Update or create KeylessBackup record
    return this.prisma.keylessBackup.upsert({
      where: {
        walletAddress,
      },
      update: {
        phone,
        updatedAt: new Date(),
      },
      create: {
        walletAddress,
        phone,
        status: 'Completed',
      },
    });
  }
}
