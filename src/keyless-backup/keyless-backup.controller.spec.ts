import { Test, TestingModule } from '@nestjs/testing';
import { KeylessBackupController } from './keyless-backup.controller';

describe('KeylessBackupController', () => {
  let controller: KeylessBackupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeylessBackupController],
    }).compile();

    controller = module.get<KeylessBackupController>(KeylessBackupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
