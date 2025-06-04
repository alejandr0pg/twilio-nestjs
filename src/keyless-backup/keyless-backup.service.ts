import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { KeylessBackupDto } from './dto/keyless-backup.dto';
import { CheckPhoneResponseDto } from './dto/check-phone.dto';

@Injectable()
export class KeylessBackupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    walletAddress: string,
    createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    const { encryptedMnemonic, encryptionAddress, phone } =
      createKeylessBackupDto;

    const existingBackup = await this.prisma.keylessBackup.findUnique({
      where: { walletAddress },
    });

    if (existingBackup) {
      return this.mapToDto(existingBackup);
    }

    const newBackup = await this.prisma.keylessBackup.create({
      data: {
        walletAddress,
        encryptedMnemonic,
        encryptionAddress,
        status: 'NotStarted',
        phone,
      },
    });

    return this.mapToDto(newBackup);
  }

  async findOne(phone: string): Promise<KeylessBackupDto | null> {
    const backup = await this.prisma.keylessBackup.findFirst({
      where: { phone },
    });

    if (!backup) {
      return null;
    }

    return this.mapToDto(backup);
  }

  async remove(walletAddress: string): Promise<void> {
    const backup = await this.prisma.keylessBackup.findUnique({
      where: { walletAddress },
    });

    if (!backup) {
      throw new NotFoundException(
        `Keyless backup not found for wallet address: ${walletAddress}`,
      );
    }

    await this.prisma.keylessBackup.delete({
      where: { id: backup.id },
    });
  }

  /**
   * Verifica si un número de teléfono ya existe en el sistema keyless backup
   * para una wallet específica o cualquier wallet
   */
  async checkPhoneExists(
    phone: string,
    walletAddress?: string,
  ): Promise<CheckPhoneResponseDto> {
    try {
      // Buscar por teléfono y wallet específica si se proporciona
      if (walletAddress) {
        const backup = await this.prisma.keylessBackup.findFirst({
          where: {
            phone,
            walletAddress,
          },
        });

        if (backup) {
          return {
            exists: true,
            walletAddress: backup.walletAddress,
            phone: backup.phone || undefined,
          };
        }
      }

      // Buscar solo por teléfono si no se especifica wallet o no se encontró con wallet específica
      const backup = await this.prisma.keylessBackup.findFirst({
        where: { phone },
      });

      if (backup) {
        return {
          exists: true,
          walletAddress: backup.walletAddress,
          phone: backup.phone as string,
        };
      }

      return {
        exists: false,
      };
    } catch (error) {
      // En caso de error, retornar que no existe para no bloquear el flujo
      console.error('Error checking phone existence:', error);
      return {
        exists: false,
      };
    }
  }

  private mapToDto(backup: any): KeylessBackupDto {
    return {
      encryptedMnemonic: backup.encryptedMnemonic || '',
      encryptionAddress: backup.encryptionAddress || '',
      walletAddress: backup.walletAddress,
      phone: backup.phone,
      status: backup.status,
      flow: backup.flow,
      origin: backup.origin,
    };
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
