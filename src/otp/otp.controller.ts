/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { OtpService } from './otp.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmergencyRecoveryDto } from './dto/emergency-recovery.dto';

@Controller('otp')
@UseGuards(JwtAuthGuard)
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() sendOtpDto: SendOtpDto, @Request() req) {
    // You can access the authenticated client's information from req.user
    // For example, you might want to log which client is requesting an OTP
    console.log(
      `Client with ID ${req.user.id} requested OTP for phone: ${sendOtpDto.phone}`,
    );

    return this.otpService.sendOtp(sendOtpDto.phone);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto, @Request() req) {
    // Similarly, you can access client information here
    console.log(
      `Client with ID ${req.user.id} is verifying OTP for phone: ${verifyOtpDto.phone}`,
    );

    return this.otpService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.code);
  }

  @Post('emergency-recovery')
  @HttpCode(HttpStatus.OK)
  async emergencyRecovery(@Body() emergencyRecoveryDto: EmergencyRecoveryDto, @Request() req) {
    console.log(
      `Client with ID ${req.user.id} requesting emergency recovery for phone: ${emergencyRecoveryDto.phone}`,
    );

    return this.otpService.emergencyRecovery(
      emergencyRecoveryDto.phone,
      emergencyRecoveryDto.walletAddress,
      emergencyRecoveryDto.adminCode
    );
  }
}
