import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KeylessBackupService } from './keyless-backup.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KeylessBackupDto } from './dto/keyless-backup.dto';

@Controller('keyless-backup')
export class KeylessBackupController {
  constructor(private readonly keylessBackupService: KeylessBackupService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req,
    @Body() createKeylessBackupDto: CreateKeylessBackupDto,
  ): Promise<KeylessBackupDto> {
    const clientId = req.user.clientId; // Assuming user.sub contains the user ID
    return this.keylessBackupService.create(clientId, createKeylessBackupDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findOne(@Request() req): Promise<KeylessBackupDto | null> {
    const clientId = req.user.clientId;
    return this.keylessBackupService.findOne(clientId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('delete')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content on successful deletion
  async remove(@Request() req): Promise<void> {
    const clientId = req.user.clientId;
    await this.keylessBackupService.remove(clientId);
  }
}