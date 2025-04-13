import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

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
}
