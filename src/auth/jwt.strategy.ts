/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') || 'defaultsecret',
      ignoreExpiration: false,
    });
  }

  validate(payload: any) {
    // Check for client ID in the payload
    if (!payload.clientId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return client information that will be available in the Request object
    return {
      clientId: payload.clientId,
      appVersion: payload.appVersion,
      // Include any other client information you need
    };
  }
}
