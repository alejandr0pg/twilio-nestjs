import { Controller, Post, Get, Body, HttpStatus, HttpException } from '@nestjs/common';
import { SiweService } from './siwe.service';
import { SiweLoginDto } from './dto/siwe-login.dto';

@Controller('siwe')
export class SiweController {
  constructor(private readonly siweService: SiweService) {}

  @Post('login')
  async login(@Body() siweLoginDto: SiweLoginDto): Promise<{ token: string }> {
    try {
      const token = await this.siweService.verifySiweAndGenerateJwt(
        siweLoginDto.message,
        siweLoginDto.signature,
      );
      return { token };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('clock')
  async clock(): Promise<{ now: string }> {
    return { now: new Date().toISOString() };
  }
}