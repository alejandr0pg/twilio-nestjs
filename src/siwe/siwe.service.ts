import { Injectable } from '@nestjs/common';
import { SiweMessage, generateNonce } from 'siwe';
import { ethers } from 'ethers';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SiweService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async verifySiweAndGenerateJwt(
    message: string,
    signature: string,
  ): Promise<string> {
    try {
      const siweMessage = new SiweMessage(message);
      const fields = await siweMessage.validate(signature);

      // Now you can use the address to identify/create a user in your system.
      const address = fields.address;

      // Find the client by the address or create a new client.
      let client = await this.prisma.client.findUnique({
        where: { clientId: address }, // Assuming the address is used as clientId
      });

      if (!client) {
        // Create a new client
        client = await this.prisma.client.create({
          data: {
            clientId: address,
            name: 'SIWE User', // You might want to ask the user for a name
            appVersion: '1.0.0', // Set a default app version
            apiKey: generateNonce(), // Generate a random apiKey
          },
        });
      }

      // Generate a JWT token for the client
      const payload = { clientId: client.id };
      const token = this.jwtService.sign(payload);
      return token;
    } catch (e) {
      throw new Error('Invalid SIWE signature.');
    }
  }
}