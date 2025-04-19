import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Req,
  HttpException,
} from '@nestjs/common';
import { KeylessBackupService } from './keyless-backup.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KeylessBackupDto } from './dto/keyless-backup.dto';
import { SiweAuthGuard } from '../auth/siwe-auth.guard';
import { RequestWithSiweSession } from '../types/siwe';

@UseGuards(SiweAuthGuard)
@Controller('keyless-backup')
export class KeylessBackupController {
  constructor(private readonly keylessBackupService: KeylessBackupService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req,
    @Body() createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    const walletAddress = req.user.walletAddress as string;
    return this.keylessBackupService.create(
      walletAddress,
      createKeylessBackupDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findOne(@Request() req): Promise<KeylessBackupDto | null> {
    const walletAddress = req.user.walletAddress;
    return this.keylessBackupService.findOne(walletAddress as string);
  }

  @UseGuards(JwtAuthGuard)
  @Get('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req): Promise<void> {
    const walletAddress = req.user.walletAddress;
    await this.keylessBackupService.remove(walletAddress as string);
  }

  @Post('link-wallet')
  async linkWalletToPhone(
    @Body() body: { phone: string; walletAddress: string; keyshare: string },
    @Req() request: RequestWithSiweSession,
  ) {
    const { phone, walletAddress, keyshare } = body;
    const { id: sessionId } = request.siweSession; // Use 'id' instead of 'sessionId'

    try {
      return await this.keylessBackupService.linkWalletToPhone(
        phone,
        walletAddress,
        keyshare,
        sessionId,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error linking wallet to phone';
      throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
    }
  }
}
