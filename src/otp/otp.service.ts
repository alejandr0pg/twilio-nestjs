import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as twilio from 'twilio';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';

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
   * Envía un código OTP al número de teléfono proporcionado
   */
  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    // Validar el formato del número de teléfono
    if (!this.isValidPhoneNumber(phone)) {
      throw new BadRequestException('Número de teléfono inválido');
    }

    // Generar código OTP
    const code = this.generateOtpCode();

    // Calcular fecha de expiración
    const expirationMinutes =
      this.configService.get<number>('OTP_EXPIRATION_MINUTES') || 10;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    // Guardar el código en la base de datos
    await this.prisma.otpCode.create({
      data: {
        phone,
        code,
        expiresAt,
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
  ): Promise<{ success: boolean; message: string; token: string; keyshare: string }> {
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

    return {
      success: true,
      message: 'Código OTP verificado correctamente',
      token: accessToken,
      keyshare: phone
    };
  }

  /**
   * Valida el formato del número de teléfono
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Implementar validación según el formato requerido
    // Este es un ejemplo básico, ajustar según necesidades
    // return /^\+[1-9]\d{1,14}$/.test(phone);
    return true
  }
}
