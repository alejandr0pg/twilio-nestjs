import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from '../otp/otp.service';
import { KeylessBackupService } from '../keyless-backup/keyless-backup.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

// Mock Twilio
const mockTwilioClient = {
  messages: {
    create: jest.fn(),
  },
};

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => mockTwilioClient);
});

describe('Recovery Scenarios', () => {
  let otpService: OtpService;
  let keylessBackupService: KeylessBackupService;
  let authService: AuthService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    otpCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    keylessBackup: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    siweSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockAuthService = {
    createSessionFromOtp: jest.fn(),
    generateAccessToken: jest.fn(),
    generateClientToken: jest.fn(),
    validateClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        KeylessBackupService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    otpService = module.get<OtpService>(OtpService);
    keylessBackupService = module.get<KeylessBackupService>(KeylessBackupService);
    authService = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Setup default config mocks
    mockConfigService.get.mockImplementation((key) => {
      const config = {
        TWILIO_ACCOUNT_SID: 'test_account_sid',
        TWILIO_AUTH_TOKEN: 'test_auth_token',
        TWILIO_PHONE_NUMBER: '+1234567890',
        EMERGENCY_RECOVERY_CODE: 'test_emergency_code',
      };
      return config[key];
    });

    // Setup default Twilio mock
    mockTwilioClient.messages.create.mockResolvedValue({
      sid: 'test_message_sid',
    });

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('Bug Reproduction - Original Issues', () => {
    it('should reproduce the original keyshare inconsistency bug', async () => {
      const testPhone = '+573045485265';
      const originalKeyshare = '4630e112ff4f06360a6b9e540f614f048e9b9ee389b1694ff588b1a999be6950';

      // Simulate the original problematic state
      const existingOtpRecords = [
        { id: 16, phone: testPhone, code: '732175', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T07:50:51.454Z') },
        { id: 17, phone: testPhone, code: '487484', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T08:09:59.700Z') },
        { id: 18, phone: testPhone, code: '439854', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T19:17:12.603Z') },
        { id: 19, phone: testPhone, code: '471129', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T19:32:17.802Z') },
        { id: 20, phone: testPhone, code: '722446', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T20:10:58.765Z') },
        { id: 21, phone: testPhone, code: '545443', keyshare: originalKeyshare, isValid: false, createdAt: new Date('2025-04-22T20:11:32.630Z') },
      ];

      // Mock finding existing keyshare (this should work with the fix)
      mockPrismaService.otpCode.findFirst.mockResolvedValue(existingOtpRecords[0]);
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 22,
        phone: testPhone,
        code: '123456',
        keyshare: originalKeyshare, // Should reuse existing keyshare
        isValid: true,
        createdAt: new Date(),
      });

      // Send OTP should now assign keyshare correctly
      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: originalKeyshare, // Fixed: should reuse existing keyshare
        },
      });
    });

    it('should handle the case where user generated multiple OTPs without keyshare', async () => {
      const testPhone = '+573052151556';
      const testKeyshare = '8642d1c5d489ffcb4ea1f4fa4b1c53e1e8b4889156e6a0a47208c3f3e7468631';

      // Simulate multiple OTPs without keyshare (original bug state)
      const otpRecords = [
        { id: 68, phone: testPhone, code: '336503', keyshare: testKeyshare, isValid: false, createdAt: new Date('2025-06-01T20:04:37.112Z') },
        { id: 69, phone: testPhone, code: '346489', keyshare: testKeyshare, isValid: false, createdAt: new Date('2025-06-01T20:09:59.850Z') },
        { id: 70, phone: testPhone, code: '158381', keyshare: testKeyshare, isValid: false, createdAt: new Date('2025-06-01T20:11:09.704Z') },
        { id: 72, phone: testPhone, code: '209120', keyshare: null, isValid: false, createdAt: new Date('2025-06-01T20:59:21.249Z') },
        { id: 73, phone: testPhone, code: '451688', keyshare: null, isValid: false, createdAt: new Date('2025-06-01T21:00:06.765Z') },
        { id: 74, phone: testPhone, code: '733517', keyshare: null, isValid: true, createdAt: new Date('2025-06-01T21:01:03.225Z') },
      ];

      // Mock finding existing keyshare from earlier attempts
      mockPrismaService.otpCode.findFirst.mockResolvedValue(otpRecords[0]); // First with keyshare
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 75,
        phone: testPhone,
        code: '999999',
        keyshare: testKeyshare, // Should reuse existing keyshare
        isValid: true,
        createdAt: new Date(),
      });

      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: testKeyshare, // Fixed: should find and reuse existing keyshare
        },
      });
    });
  });

  describe('Edge Case Recovery Scenarios', () => {
    it('should handle recovery when user has backup but no OTP history', async () => {
      const testPhone = '+573001234567';
      const testWalletAddress = '0x1234567890abcdef';
      const testKeyshare = 'new_keyshare_123';

      // User has backup but no OTP history
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        encryptedMnemonic: 'encrypted_mnemonic',
        encryptionAddress: '0xencryption123',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null); // No existing OTP history

      // Emergency recovery should generate new keyshare
      const mockRandomBytes = jest.spyOn(require('crypto'), 'randomBytes');
      mockRandomBytes.mockReturnValue(Buffer.from('new_keyshare_123'));

      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '777777',
        keyshare: testKeyshare,
        isValid: true,
        isEmergency: true,
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'emergency_token',
        sessionId: 'emergency_session',
      });

      mockPrismaService.keylessBackup.update.mockResolvedValue(mockBackup);

      const result = await otpService.emergencyRecovery(
        testPhone,
        testWalletAddress,
        'test_emergency_code'
      );

      expect(result.success).toBe(true);
      expect(result.keyshare).toBe('6e65775f6b657973686172655f313233'); // hex encoded
      expect(mockRandomBytes).toHaveBeenCalledWith(32);

      mockRandomBytes.mockRestore();
    });

    it('should handle recovery when backup exists but phone mismatch', async () => {
      const testPhone = '+573001234567';
      const differentPhone = '+573009999999';
      const testWalletAddress = '0x1234567890abcdef';

      // Backup exists but with different phone
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: differentPhone,
        encryptedMnemonic: 'encrypted_mnemonic',
        encryptionAddress: '0xencryption123',
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(null); // No backup for testPhone + wallet combo

      await expect(
        otpService.emergencyRecovery(testPhone, testWalletAddress, 'test_emergency_code')
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle concurrent recovery attempts', async () => {
      const testPhone = '+573001234567';
      const testCode = '123456';
      const testKeyshare = 'concurrent_keyshare_123';

      // Simulate concurrent verify attempts
      const mockOtpCode = {
        id: 1,
        phone: testPhone,
        code: testCode,
        isValid: true,
        expiresAt: new Date(Date.now() + 300000),
      };

      const mockExistingKeyshare = {
        keyshare: testKeyshare,
      };

      mockPrismaService.otpCode.findFirst
        .mockResolvedValue(mockOtpCode) // First call for OTP verification
        .mockResolvedValue(mockExistingKeyshare); // Second call for keyshare lookup

      mockPrismaService.otpCode.update.mockResolvedValue({
        ...mockOtpCode,
        isValid: false,
        keyshare: testKeyshare,
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'test_token',
        sessionId: 'test_session_id',
      });

      // Multiple concurrent verifications
      const promises = [
        otpService.verifyOtp(testPhone, testCode),
        otpService.verifyOtp(testPhone, testCode),
        otpService.verifyOtp(testPhone, testCode),
      ];

      const results = await Promise.all(promises);

      // First should succeed, others should fail due to invalid OTP
      expect(results[0].success).toBe(true);
      expect(results[0].keyshare).toBe(testKeyshare);
      
      // Others should fail because OTP is already used
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
    });

    it('should handle recovery with corrupted keyshare data', async () => {
      const testPhone = '+573001234567';
      const testWalletAddress = '0x1234567890abcdef';
      const corruptedKeyshare = 'corrupted_keyshare_!@#$%^&*()';

      // Backup exists but with corrupted keyshare
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        encryptedMnemonic: 'encrypted_mnemonic',
        encryptionAddress: '0xencryption123',
        status: 'Completed',
      };

      const mockCorruptedOtp = {
        keyshare: corruptedKeyshare,
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(mockCorruptedOtp);

      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '777777',
        keyshare: corruptedKeyshare, // Should use existing corrupted keyshare
        isValid: true,
        isEmergency: true,
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'emergency_token',
        sessionId: 'emergency_session',
      });

      mockPrismaService.keylessBackup.update.mockResolvedValue(mockBackup);

      const result = await otpService.emergencyRecovery(
        testPhone,
        testWalletAddress,
        'test_emergency_code'
      );

      expect(result.success).toBe(true);
      expect(result.keyshare).toBe(corruptedKeyshare); // Should use existing keyshare even if corrupted
    });

    it('should handle recovery when emergency codes are invalidated', async () => {
      const testPhone = '+573001234567';
      const testKeyshare = 'emergency_keyshare_123';

      // Simulate emergency code being invalidated by normal sendOtp
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: testKeyshare,
      });

      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: testKeyshare,
        isValid: true,
        isEmergency: false,
      });

      // Send normal OTP
      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);

      // Verify that emergency codes are NOT invalidated
      expect(mockPrismaService.otpCode.updateMany).toHaveBeenCalledWith({
        where: {
          phone: testPhone,
          isValid: true,
          isEmergency: false, // Only non-emergency codes should be invalidated
        },
        data: { isValid: false },
      });
    });

    it('should handle recovery with session expiration during process', async () => {
      const testPhone = '+573001234567';
      const testWalletAddress = '0x1234567890abcdef';
      const testKeyshare = 'session_keyshare_123';
      const testSessionId = 'expiring_session_123';

      // Session that will expire during the process
      const mockSession = {
        id: testSessionId,
        address: testPhone,
        chainId: 0,
        message: 'OTP Authentication',
        signature: testKeyshare,
        expirationTime: new Date(Date.now() + 1000), // Expires in 1 second
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.siweSession.findUnique.mockResolvedValue(mockSession);

      // Simulate delay to cause session expiration
      setTimeout(() => {
        mockSession.expirationTime = new Date(Date.now() - 1000); // Now expired
      }, 500);

      await expect(
        keylessBackupService.linkWalletToPhone(
          testPhone,
          testWalletAddress,
          testKeyshare,
          testSessionId
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Stress Test Scenarios', () => {
    it('should handle rapid succession of OTP requests', async () => {
      const testPhone = '+573001234567';
      const testKeyshare = 'rapid_keyshare_123';

      // Mock existing keyshare
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: testKeyshare,
      });

      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: testKeyshare,
        isValid: true,
      });

      // Rapid succession of OTP requests
      const rapidRequests = Array.from({ length: 10 }, (_, i) => 
        otpService.sendOtp(testPhone)
      );

      const results = await Promise.all(rapidRequests);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should have called create multiple times
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledTimes(10);
    });

    it('should handle massive number of expired OTP codes', async () => {
      const testPhone = '+573001234567';
      const testKeyshare = 'massive_keyshare_123';

      // Simulate finding keyshare from hundreds of expired codes
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: testKeyshare,
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
      });

      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 999 }); // Many expired codes
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1000,
        phone: testPhone,
        code: '123456',
        keyshare: testKeyshare,
        isValid: true,
      });

      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: testKeyshare, // Should still find and reuse keyshare
        },
      });
    });
  });

  describe('Database Failure Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      const testPhone = '+573001234567';

      mockPrismaService.otpCode.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(otpService.sendOtp(testPhone)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle partial database failures during recovery', async () => {
      const testPhone = '+573001234567';
      const testCode = '123456';
      const testKeyshare = 'partial_failure_keyshare';

      // OTP verification succeeds
      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce({
          id: 1,
          phone: testPhone,
          code: testCode,
          isValid: true,
          expiresAt: new Date(Date.now() + 300000),
        })
        .mockResolvedValueOnce({ keyshare: testKeyshare });

      // But update fails
      mockPrismaService.otpCode.update.mockRejectedValue(
        new Error('Database update failed')
      );

      await expect(otpService.verifyOtp(testPhone, testCode)).rejects.toThrow(
        'Database update failed'
      );
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle malformed keyshare injection attempts', async () => {
      const testPhone = '+573001234567';
      const maliciousKeyshare = "'; DROP TABLE OtpCode; --";

      // Mock existing keyshare with malicious content
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: maliciousKeyshare,
      });

      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: maliciousKeyshare,
        isValid: true,
      });

      // Should handle malicious keyshare without SQL injection
      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: maliciousKeyshare, // Should be safely handled by Prisma
        },
      });
    });

    it('should handle extremely long keyshare values', async () => {
      const testPhone = '+573001234567';
      const longKeyshare = 'a'.repeat(10000); // 10KB keyshare

      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: longKeyshare,
      });

      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: longKeyshare,
        isValid: true,
      });

      const result = await otpService.sendOtp(testPhone);

      expect(result.success).toBe(true);
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: longKeyshare, // Should handle long keyshares
        },
      });
    });
  });
});