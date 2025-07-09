import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { KeylessBackupService } from './keyless-backup.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateKeylessBackupDto } from './dto/create-keyless-backup.dto';

describe('KeylessBackupService', () => {
  let service: KeylessBackupService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    keylessBackup: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    siweSession: {
      findUnique: jest.fn(),
    },
    otpCode: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeylessBackupService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<KeylessBackupService>(KeylessBackupService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('create', () => {
    const testWalletAddress = '0x1234567890abcdef';
    const createDto: CreateKeylessBackupDto = {
      encryptedMnemonic: 'encrypted_mnemonic_123',
      encryptionAddress: '0xabcdef1234567890',
      phone: '+573001234567',
    };

    it('should create new keyless backup successfully', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        encryptedMnemonic: createDto.encryptedMnemonic,
        encryptionAddress: createDto.encryptionAddress,
        phone: createDto.phone,
        status: 'NotStarted',
        flow: null,
        origin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(null);
      mockPrismaService.keylessBackup.create.mockResolvedValue(mockBackup);

      const result = await service.create(testWalletAddress, createDto);

      expect(result).toEqual({
        encryptedMnemonic: createDto.encryptedMnemonic,
        encryptionAddress: createDto.encryptionAddress,
        walletAddress: testWalletAddress,
        phone: createDto.phone,
        status: 'NotStarted',
        flow: null,
        origin: null,
      });

      expect(mockPrismaService.keylessBackup.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: testWalletAddress },
      });

      expect(mockPrismaService.keylessBackup.create).toHaveBeenCalledWith({
        data: {
          walletAddress: testWalletAddress,
          encryptedMnemonic: createDto.encryptedMnemonic,
          encryptionAddress: createDto.encryptionAddress,
          status: 'NotStarted',
          phone: createDto.phone,
        },
      });
    });

    it('should return existing backup if wallet already exists', async () => {
      const existingBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        encryptedMnemonic: 'existing_encrypted_mnemonic',
        encryptionAddress: '0xexisting123',
        phone: '+573009999999',
        status: 'Completed',
        flow: 'registration',
        origin: 'mobile',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(existingBackup);

      const result = await service.create(testWalletAddress, createDto);

      expect(result).toEqual({
        encryptedMnemonic: 'existing_encrypted_mnemonic',
        encryptionAddress: '0xexisting123',
        walletAddress: testWalletAddress,
        phone: '+573009999999',
        status: 'Completed',
        flow: 'registration',
        origin: 'mobile',
      });

      // Should not call create if backup exists
      expect(mockPrismaService.keylessBackup.create).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.keylessBackup.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.create(testWalletAddress, createDto)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('findOne', () => {
    const testPhone = '+573001234567';

    it('should find backup by phone successfully', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: '0x1234567890abcdef',
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        phone: testPhone,
        status: 'Completed',
        flow: 'recovery',
        origin: 'web',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);

      const result = await service.findOne(testPhone);

      expect(result).toEqual({
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        walletAddress: '0x1234567890abcdef',
        phone: testPhone,
        status: 'Completed',
        flow: 'recovery',
        origin: 'web',
      });

      expect(mockPrismaService.keylessBackup.findFirst).toHaveBeenCalledWith({
        where: { phone: testPhone },
      });
    });

    it('should return null if backup not found', async () => {
      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(null);

      const result = await service.findOne(testPhone);

      expect(result).toBeNull();
    });

    it('should handle empty phone number', async () => {
      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(null);

      const result = await service.findOne('');

      expect(result).toBeNull();
      expect(mockPrismaService.keylessBackup.findFirst).toHaveBeenCalledWith({
        where: { phone: '' },
      });
    });
  });

  describe('remove', () => {
    const testWalletAddress = '0x1234567890abcdef';

    it('should remove backup successfully', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        phone: '+573001234567',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(mockBackup);
      mockPrismaService.keylessBackup.delete.mockResolvedValue(mockBackup);

      await service.remove(testWalletAddress);

      expect(mockPrismaService.keylessBackup.findUnique).toHaveBeenCalledWith({
        where: { walletAddress: testWalletAddress },
      });

      expect(mockPrismaService.keylessBackup.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException if backup not found', async () => {
      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(null);

      await expect(service.remove(testWalletAddress)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.remove(testWalletAddress)).rejects.toThrow(
        `Keyless backup not found for wallet address: ${testWalletAddress}`
      );

      expect(mockPrismaService.keylessBackup.delete).not.toHaveBeenCalled();
    });
  });

  describe('checkPhoneExists', () => {
    const testPhone = '+573001234567';
    const testWalletAddress = '0x1234567890abcdef';

    it('should find backup by phone and wallet address', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);

      const result = await service.checkPhoneExists(testPhone, testWalletAddress);

      expect(result).toEqual({
        exists: true,
        walletAddress: testWalletAddress,
        phone: testPhone,
      });

      expect(mockPrismaService.keylessBackup.findFirst).toHaveBeenCalledWith({
        where: {
          phone: testPhone,
          walletAddress: testWalletAddress,
        },
      });
    });

    it('should find backup by phone only when wallet not specified', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: '0xdifferent123',
        phone: testPhone,
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);

      const result = await service.checkPhoneExists(testPhone);

      expect(result).toEqual({
        exists: true,
        walletAddress: '0xdifferent123',
        phone: testPhone,
      });

      expect(mockPrismaService.keylessBackup.findFirst).toHaveBeenCalledWith({
        where: { phone: testPhone },
      });
    });

    it('should return false if backup not found', async () => {
      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(null);

      const result = await service.checkPhoneExists(testPhone, testWalletAddress);

      expect(result).toEqual({
        exists: false,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.keylessBackup.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.checkPhoneExists(testPhone, testWalletAddress);

      expect(result).toEqual({
        exists: false,
      });
    });

    it('should search by phone only if wallet specific search fails', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: '0xdifferent123',
        phone: testPhone,
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findFirst
        .mockResolvedValueOnce(null) // First call with wallet address fails
        .mockResolvedValueOnce(mockBackup); // Second call with phone only succeeds

      const result = await service.checkPhoneExists(testPhone, testWalletAddress);

      expect(result).toEqual({
        exists: true,
        walletAddress: '0xdifferent123',
        phone: testPhone,
      });

      expect(mockPrismaService.keylessBackup.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('linkWalletToPhone', () => {
    const testPhone = '+573001234567';
    const testWalletAddress = '0x1234567890abcdef';
    const testKeyshare = 'valid_keyshare_123';
    const testSessionId = 'valid_session_123';

    it('should link wallet to phone successfully', async () => {
      const mockSession = {
        id: testSessionId,
        address: '0xsession123',
        chainId: 42220,
        message: 'Sign in with Ethereum',
        signature: '0xsignature123',
        expirationTime: new Date(Date.now() + 300000), // 5 minutes from now
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOtpRecord = {
        id: 1,
        phone: testPhone,
        keyshare: testKeyshare,
        createdAt: new Date(),
      };

      const mockUpsertResult = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'Completed',
        encryptedMnemonic: null,
        encryptionAddress: null,
        flow: null,
        origin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.siweSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(mockOtpRecord);
      mockPrismaService.keylessBackup.upsert.mockResolvedValue(mockUpsertResult);

      const result = await service.linkWalletToPhone(
        testPhone,
        testWalletAddress,
        testKeyshare,
        testSessionId
      );

      expect(result).toEqual(mockUpsertResult);

      // Verify session was checked
      expect(mockPrismaService.siweSession.findUnique).toHaveBeenCalledWith({
        where: { id: testSessionId },
      });

      // Verify OTP record was checked
      expect(mockPrismaService.otpCode.findFirst).toHaveBeenCalledWith({
        where: { phone: testPhone, keyshare: testKeyshare },
        orderBy: { createdAt: 'desc' },
      });

      // Verify wallet was linked
      expect(mockPrismaService.keylessBackup.upsert).toHaveBeenCalledWith({
        where: { walletAddress: testWalletAddress },
        update: {
          phone: testPhone,
          updatedAt: expect.any(Date),
        },
        create: {
          walletAddress: testWalletAddress,
          phone: testPhone,
          status: 'Completed',
        },
      });
    });

    it('should throw UnauthorizedException if session not found', async () => {
      mockPrismaService.siweSession.findUnique.mockResolvedValue(null);

      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow('Invalid session');
    });

    it('should throw UnauthorizedException if session expired', async () => {
      const expiredSession = {
        id: testSessionId,
        address: '0xsession123',
        chainId: 42220,
        message: 'Sign in with Ethereum',
        signature: '0xsignature123',
        expirationTime: new Date(Date.now() - 300000), // 5 minutes ago
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.siweSession.findUnique.mockResolvedValue(expiredSession);

      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow('Session expired');
    });

    it('should throw UnauthorizedException if OTP record not found', async () => {
      const mockSession = {
        id: testSessionId,
        address: '0xsession123',
        chainId: 42220,
        message: 'Sign in with Ethereum',
        signature: '0xsignature123',
        expirationTime: new Date(Date.now() + 300000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.siweSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow('Invalid keyshare or phone number');
    });

    it('should handle mismatched keyshares', async () => {
      const mockSession = {
        id: testSessionId,
        address: '0xsession123',
        chainId: 42220,
        message: 'Sign in with Ethereum',
        signature: '0xsignature123',
        expirationTime: new Date(Date.now() + 300000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.siweSession.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      await expect(
        service.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          'wrong_keyshare',
          testSessionId
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values gracefully', async () => {
      const createDto: CreateKeylessBackupDto = {
        encryptedMnemonic: null,
        encryptionAddress: null,
        phone: '+573001234567',
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(null);
      mockPrismaService.keylessBackup.create.mockResolvedValue({
        id: 1,
        walletAddress: '0x123',
        encryptedMnemonic: null,
        encryptionAddress: null,
        phone: '+573001234567',
        status: 'NotStarted',
        flow: null,
        origin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create('0x123', createDto);

      expect(result.encryptedMnemonic).toBe('');
      expect(result.encryptionAddress).toBe('');
    });

    it('should handle concurrent wallet creation attempts', async () => {
      const createDto: CreateKeylessBackupDto = {
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        phone: '+573001234567',
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(null);
      mockPrismaService.keylessBackup.create.mockResolvedValue({
        id: 1,
        walletAddress: '0x123',
        encryptedMnemonic: createDto.encryptedMnemonic,
        encryptionAddress: createDto.encryptionAddress,
        phone: createDto.phone,
        status: 'NotStarted',
        flow: null,
        origin: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simulate concurrent requests
      const promises = [
        service.create('0x123', createDto),
        service.create('0x123', createDto),
        service.create('0x123', createDto),
      ];

      const results = await Promise.all(promises);

      // All should succeed (first one creates, others return existing)
      results.forEach(result => {
        expect(result.walletAddress).toBe('0x123');
      });
    });

    it('should handle database constraint violations', async () => {
      const createDto: CreateKeylessBackupDto = {
        encryptedMnemonic: 'encrypted_mnemonic_123',
        encryptionAddress: '0xabcdef1234567890',
        phone: '+573001234567',
      };

      mockPrismaService.keylessBackup.findUnique.mockResolvedValue(null);
      mockPrismaService.keylessBackup.create.mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(service.create('0x123', createDto)).rejects.toThrow(
        'Unique constraint violation'
      );
    });
  });
});
