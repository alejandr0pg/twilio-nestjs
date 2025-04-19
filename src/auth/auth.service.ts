import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateClient(clientId: string, apiKey: string): Promise<any> {
    const client = await this.prisma.client.findFirst({
      where: {
        clientId,
        apiKey,
        isActive: true,
      },
    });

    if (!client) {
      return null;
    }

    return client;
  }

  generateAccessToken(phone: string): string {
    const payload = { phone };
    return this.jwtService.sign(payload);
  }

  generateClientToken(clientId: string, appVersion: string): string {
    const payload = { clientId, appVersion };
    return this.jwtService.sign(payload);
  }

  async createSessionFromOtp(
    keyshare: string,
    phone: string,
  ): Promise<{ token: string; sessionId: string }> {
    const sessionId = crypto.randomUUID();

    // Create session expiration (24 hours)
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 24);

    // Create OTP session entry
    await this.prisma.siweSession.create({
      data: {
        id: sessionId,
        address: phone, // Using phone as address for OTP sessions
        chainId: 0, // Special value to indicate OTP session
        message: 'OTP Authentication',
        signature: keyshare, // Using keyshare as signature
        expirationTime,
      },
    });

    // Generate JWT token with session info
    const token = this.jwtService.sign({
      sub: phone,
      clientId: phone,
      appVersion: '1.0.0',
      sessionId,
      keyshare,
    });

    return { token, sessionId };
  }
}
