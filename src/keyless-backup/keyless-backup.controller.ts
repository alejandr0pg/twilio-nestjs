import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  Headers,
  HttpStatus,
  Req,
  HttpException,
  Query,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { KeylessBackupService } from './keyless-backup.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { KeylessBackupDto } from './dto/keyless-backup.dto';
import { SiweAuthGuard } from '../auth/siwe-auth.guard';
import { RequestWithSiweSession } from '../types/siwe';

@UseGuards(SiweAuthGuard)
@Controller('keyless-backup')
export class KeylessBackupController {
  constructor(private readonly keylessBackupService: KeylessBackupService) {}

  @Post()
  async create(
    @Headers('walletAddress') walletAddress: string,
    @Body() createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    Logger.log('walletAddress', walletAddress);
    Logger.log('createKeylessBackupDto', createKeylessBackupDto);

    return this.keylessBackupService.create(
      walletAddress,
      createKeylessBackupDto,
    );
  }

  @Get()
  async findOne(
    @Headers('walletAddress') walletAddress: string,
    @Query('flow') flow?: 'Setup' | 'Restore',
  ): Promise<KeylessBackupDto | null> {
    try {
      const backup = await this.keylessBackupService.findOne(walletAddress);

      if (!backup && flow === 'Restore') {
        throw new NotFoundException('Keyless backup not found');
      }

      return backup;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new HttpException(
        'Error retrieving keyless backup',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

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
