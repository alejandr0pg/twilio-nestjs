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

    // Invalidar códigos anteriores para el mismo número
    await this.prisma.otpCode.updateMany({
      where: { phone, isValid: true },
      data: { isValid: false },
    });

    // Guardar el nuevo código en la base de datos
    await this.prisma.otpCode.create({
      data: {
        phone,
        code,
        expiresAt,
        isValid: true,
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

    // Generar un keyshare seguro
    const keyshare = crypto.randomBytes(32).toString('hex');

    // Crear una sesión OTP
    const { token, sessionId } = await this.authService.createSessionFromOtp(
      keyshare,
      phone,
    );

    // Actualizar el registro OTP con el keyshare
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: {
        isValid: false,
        keyshare,
      },
    });

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
}
