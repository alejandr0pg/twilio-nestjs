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
  async sendOtp(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
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
  ): Promise<{ success: boolean; message: string; token?: string; keyshare?: string }> {
    // Buscar el código más reciente para el número de teléfono
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

    // Invalidar el código después de verificarlo
    await this.prisma.otpCode.update({
      where: { id: otpCode.id },
      data: { isValid: false },
    });

    // Generate access token
    const accessToken = this.authService.generateAccessToken(phone);

    // Generate a secure random keyshare (16 bytes -> 32 hex characters)
    const keyshare = crypto.randomBytes(16).toString('hex');

    return {
      success: true,
      message: 'Código OTP verificado correctamente.',
      token: accessToken,
      keyshare: keyshare, // Use the generated keyshare
    };
  }
}
