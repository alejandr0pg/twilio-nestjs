import { Test, TestingModule } from '@nestjs/testing';
import { KeylessBackupService } from './keyless-backup.service';

describe('KeylessBackupService', () => {
  let service: KeylessBackupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeylessBackupService],
    }).compile();

    service = module.get<KeylessBackupService>(KeylessBackupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
