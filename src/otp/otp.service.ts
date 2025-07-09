import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as twilio from 'twilio';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import * as crypto from 'crypto'; // Import the crypto module

@Injectable()
export class OtpService {
  private twilioClient: twilio.Twilio;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    this.twilioClient = twilio(
      this.configService.get('TWILIO_ACCOUNT_SID'),
      this.configService.get('TWILIO_AUTH_TOKEN'),
    );
  }

  /**
   * Genera un código OTP aleatorio de 6 dígitos
   */
  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Envía un código OTP al número de teléfono especificado
   */
  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    const code = this.generateOtpCode();
    const expirationMinutes = 5; // El código expira en 5 minutos
    const expiresAt = new Date(Date.now() + expirationMinutes * 60000);

    // Buscar keyshare existente para reutilizar
    const existingKeyshare = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        keyshare: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Invalidar códigos anteriores para el mismo número (excepto códigos de emergencia)
    await this.prisma.otpCode.updateMany({
      where: { 
        phone, 
        isValid: true,
        isEmergency: false
      },
      data: { isValid: false },
    });

    // Guardar el nuevo código en la base de datos con keyshare existente
    await this.prisma.otpCode.create({
      data: {
        phone,
        code,
        expiresAt,
        isValid: true,
        keyshare: existingKeyshare?.keyshare, // Asignar keyshare existente
      },
    });

    // Enviar el código por SMS usando Twilio
    try {
      await this.twilioClient.messages.create({
        body: `Tu código de verificación es: ${code}. Válido por ${expirationMinutes} minutos.`,
        from: this.configService.get('TWILIO_PHONE_NUMBER'),
        to: phone,
      });

      return {
        success: true,
        message: 'Código OTP enviado correctamente',
      };
    } catch (error) {
      // Si hay un error al enviar el SMS, invalidamos el código en la base de datos
      await this.prisma.otpCode.updateMany({
        where: { phone, code },
        data: { isValid: false },
      });

      throw new BadRequestException(
        `Error al enviar el código OTP: ${error.message}`,
      );
    }
  }

  /**
   * Verifica si un código OTP es válido
   */
  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{
    success: boolean;
    message: string;
    token?: string;
    keyshare?: string;
    sessionId?: string;
  }> {
    // Verificar el código OTP
    const otpCode = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        isValid: true,
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!otpCode) {
      return {
        success: false,
        message: 'Código OTP inválido o expirado',
      };
    }

    // Buscar keyshare existente válido para este teléfono
    const existingKeyshare = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        keyshare: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Usar keyshare existente o generar uno nuevo
    const keyshare = existingKeyshare?.keyshare ?? crypto.randomBytes(32).toString('hex');

    // Actualizar el registro OTP con el keyshare
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: {
        isValid: false,
        keyshare,
      },
    });

    // Crear una sesión OTP
    const { token, sessionId } = await this.authService.createSessionFromOtp(
      keyshare as string,
      phone,
    );

    return {
      success: true,
      message: 'Código OTP verificado correctamente',
      token,
      keyshare,
      sessionId,
    };
  }

  async linkWalletToPhone(
    phone: string,
    walletAddress: string,
    keyshare: string,
  ) {
    // Verificar que existe un OTP válido con ese keyshare
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
      throw new BadRequestException('Invalid keyshare or phone number');
    }

    // Actualizar o crear el registro de KeylessBackup
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

  /**
   * Recuperación de emergencia para usuarios con problemas de keyshare
   * Solo debe ser usado por administradores para casos críticos
   */
  async emergencyRecovery(
    phone: string,
    walletAddress: string,
    adminCode: string,
  ): Promise<{
    success: boolean;
    message: string;
    keyshare?: string;
    token?: string;
    sessionId?: string;
  }> {
    // Verificar código de administrador
    const validAdminCode = this.configService.get('EMERGENCY_RECOVERY_CODE');
    if (!validAdminCode || adminCode !== validAdminCode) {
      throw new BadRequestException('Invalid admin code');
    }

    // Verificar que existe un backup para esta wallet y teléfono
    const backup = await this.prisma.keylessBackup.findFirst({
      where: {
        walletAddress,
        phone,
      },
    });

    if (!backup) {
      throw new BadRequestException('No backup found for this wallet and phone');
    }

    // Buscar keyshare existente válido para este teléfono
    const existingOtp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        keyshare: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Usar keyshare existente o generar uno nuevo
    const keyshare = existingOtp?.keyshare || crypto.randomBytes(32).toString('hex');

    // Crear un OTP de emergencia válido por 7 días
    const emergencyOtp = await this.prisma.otpCode.create({
      data: {
        phone,
        code: '777777', // Código especial para recuperación de emergencia
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        isValid: true,
        keyshare,
        isEmergency: true, // Marcar como emergencia para protección
      },
    });

    // Crear sesión de emergencia
    const { token, sessionId } = await this.authService.createSessionFromOtp(
      keyshare,
      phone,
    );

    // Actualizar el estado del backup
    await this.prisma.keylessBackup.update({
      where: {
        walletAddress,
      },
      data: {
        status: 'Emergency_Recovery',
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Emergency recovery OTP created successfully',
      keyshare,
      token,
      sessionId,
    };
  }
}
