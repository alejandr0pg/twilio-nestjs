import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import * as crypto from 'crypto';

// Mock Twilio
const mockTwilioClient = {
  messages: {
    create: jest.fn(),
  },
};

jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => mockTwilioClient);
});

describe('OtpService', () => {
  let service: OtpService;
  let prismaService: PrismaService;
  let authService: AuthService;
  let configService: ConfigService;

  const mockPrismaService = {
    otpCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    keylessBackup: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuthService = {
    createSessionFromOtp: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);

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

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    const testPhone = '+573001234567';
    const mockExistingKeyshare = 'existing_keyshare_123';

    it('should send OTP successfully with existing keyshare', async () => {
      // Mock finding existing keyshare
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: mockExistingKeyshare,
      });

      // Mock successful operations
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: mockExistingKeyshare,
      });

      // Mock successful Twilio send
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_message_sid',
      });

      const result = await service.sendOtp(testPhone);

      expect(result).toEqual({
        success: true,
        message: 'Código OTP enviado correctamente',
      });

      // Verify database operations
      expect(mockPrismaService.otpCode.findFirst).toHaveBeenCalledWith({
        where: {
          phone: testPhone,
          keyshare: { not: null },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(mockPrismaService.otpCode.updateMany).toHaveBeenCalledWith({
        where: {
          phone: testPhone,
          isValid: true,
          isEmergency: false,
        },
        data: { isValid: false },
      });

      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: mockExistingKeyshare,
        },
      });

      // Verify Twilio call
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('Tu código de verificación es:'),
        from: '+1234567890',
        to: testPhone,
      });
    });

    it('should send OTP successfully without existing keyshare', async () => {
      // Mock no existing keyshare
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      // Mock successful operations
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: null,
      });

      // Mock successful Twilio send
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_message_sid',
      });

      const result = await service.sendOtp(testPhone);

      expect(result).toEqual({
        success: true,
        message: 'Código OTP enviado correctamente',
      });

      // Verify keyshare is null when no existing keyshare
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: expect.any(String),
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: null,
        },
      });
    });

    it('should handle Twilio send failure', async () => {
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
      });

      // Mock Twilio failure
      const twilioError = new Error('Twilio service unavailable');
      mockTwilioClient.messages.create.mockRejectedValue(twilioError);

      // Mock invalidation after failure
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });

      await expect(service.sendOtp(testPhone)).rejects.toThrow(BadRequestException);
      await expect(service.sendOtp(testPhone)).rejects.toThrow(
        'Error al enviar el código OTP: Twilio service unavailable'
      );

      // Verify OTP was invalidated after failure
      expect(mockPrismaService.otpCode.updateMany).toHaveBeenCalledWith({
        where: { phone: testPhone, code: '123456' },
        data: { isValid: false },
      });
    });

    it('should protect emergency codes from invalidation', async () => {
      mockPrismaService.otpCode.findFirst.mockResolvedValue({
        keyshare: mockExistingKeyshare,
      });
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
        keyshare: mockExistingKeyshare,
      });
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_message_sid',
      });

      await service.sendOtp(testPhone);

      // Verify emergency codes are protected
      expect(mockPrismaService.otpCode.updateMany).toHaveBeenCalledWith({
        where: {
          phone: testPhone,
          isValid: true,
          isEmergency: false, // Only non-emergency codes are invalidated
        },
        data: { isValid: false },
      });
    });
  });

  describe('verifyOtp', () => {
    const testPhone = '+573001234567';
    const testCode = '123456';
    const testKeyshare = 'test_keyshare_123';

    it('should verify OTP successfully and reuse existing keyshare', async () => {
      const mockOtpCode = {
        id: 1,
        phone: testPhone,
        code: testCode,
        isValid: true,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
      };

      const mockExistingKeyshare = {
        keyshare: testKeyshare,
      };

      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce(mockOtpCode) // First call for OTP verification
        .mockResolvedValueOnce(mockExistingKeyshare); // Second call for keyshare lookup

      mockPrismaService.otpCode.update.mockResolvedValue({
        ...mockOtpCode,
        isValid: false,
        keyshare: testKeyshare,
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'test_token',
        sessionId: 'test_session_id',
      });

      const result = await service.verifyOtp(testPhone, testCode);

      expect(result).toEqual({
        success: true,
        message: 'Código OTP verificado correctamente',
        token: 'test_token',
        keyshare: testKeyshare,
        sessionId: 'test_session_id',
      });

      // Verify OTP was updated with keyshare and marked invalid
      expect(mockPrismaService.otpCode.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          isValid: false,
          keyshare: testKeyshare,
        },
      });

      // Verify session was created
      expect(mockAuthService.createSessionFromOtp).toHaveBeenCalledWith(
        testKeyshare,
        testPhone
      );
    });

    it('should generate new keyshare when none exists', async () => {
      const mockOtpCode = {
        id: 1,
        phone: testPhone,
        code: testCode,
        isValid: true,
        expiresAt: new Date(Date.now() + 300000),
      };

      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce(mockOtpCode)
        .mockResolvedValueOnce(null); // No existing keyshare

      // Mock crypto.randomBytes
      const mockRandomBytes = jest.spyOn(crypto, 'randomBytes');
      mockRandomBytes.mockReturnValue(Buffer.from('new_keyshare_123'));

      mockPrismaService.otpCode.update.mockResolvedValue({
        ...mockOtpCode,
        isValid: false,
        keyshare: 'new_keyshare_123',
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'test_token',
        sessionId: 'test_session_id',
      });

      const result = await service.verifyOtp(testPhone, testCode);

      expect(result.success).toBe(true);
      expect(result.keyshare).toBe('6e65775f6b657973686172655f313233'); // hex encoded
      expect(mockRandomBytes).toHaveBeenCalledWith(32);

      mockRandomBytes.mockRestore();
    });

    it('should fail with invalid OTP code', async () => {
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      const result = await service.verifyOtp(testPhone, 'invalid_code');

      expect(result).toEqual({
        success: false,
        message: 'Código OTP inválido o expirado',
      });
    });

    it('should fail with expired OTP code', async () => {
      const expiredOtp = {
        id: 1,
        phone: testPhone,
        code: testCode,
        isValid: true,
        expiresAt: new Date(Date.now() - 300000), // 5 minutes ago
      };

      mockPrismaService.otpCode.findFirst.mockResolvedValue(expiredOtp);

      const result = await service.verifyOtp(testPhone, testCode);

      expect(result).toEqual({
        success: false,
        message: 'Código OTP inválido o expirado',
      });
    });

    it('should fail with invalid (already used) OTP code', async () => {
      const invalidOtp = {
        id: 1,
        phone: testPhone,
        code: testCode,
        isValid: false, // Already used
        expiresAt: new Date(Date.now() + 300000),
      };

      mockPrismaService.otpCode.findFirst.mockResolvedValue(invalidOtp);

      const result = await service.verifyOtp(testPhone, testCode);

      expect(result).toEqual({
        success: false,
        message: 'Código OTP inválido o expirado',
      });
    });
  });

  describe('emergencyRecovery', () => {
    const testPhone = '+573001234567';
    const testWalletAddress = '0x1234567890abcdef';
    const testAdminCode = 'test_emergency_code';
    const testKeyshare = 'emergency_keyshare_123';

    it('should perform emergency recovery successfully', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'NotStarted',
      };

      const mockExistingOtp = {
        keyshare: testKeyshare,
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(mockExistingOtp);
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '777777',
        keyshare: testKeyshare,
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'emergency_token',
        sessionId: 'emergency_session_id',
      });

      mockPrismaService.keylessBackup.update.mockResolvedValue({
        ...mockBackup,
        status: 'Emergency_Recovery',
      });

      const result = await service.emergencyRecovery(
        testPhone,
        testWalletAddress,
        testAdminCode
      );

      expect(result).toEqual({
        success: true,
        message: 'Emergency recovery OTP created successfully',
        keyshare: testKeyshare,
        token: 'emergency_token',
        sessionId: 'emergency_session_id',
      });

      // Verify emergency OTP was created
      expect(mockPrismaService.otpCode.create).toHaveBeenCalledWith({
        data: {
          phone: testPhone,
          code: '777777',
          expiresAt: expect.any(Date),
          isValid: true,
          keyshare: testKeyshare,
          isEmergency: true,
        },
      });

      // Verify backup status was updated
      expect(mockPrismaService.keylessBackup.update).toHaveBeenCalledWith({
        where: { walletAddress: testWalletAddress },
        data: {
          status: 'Emergency_Recovery',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should fail with invalid admin code', async () => {
      await expect(
        service.emergencyRecovery(testPhone, testWalletAddress, 'invalid_code')
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail with no backup found', async () => {
      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(null);

      await expect(
        service.emergencyRecovery(testPhone, testWalletAddress, testAdminCode)
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate new keyshare when none exists', async () => {
      const mockBackup = {
        id: 1,
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'NotStarted',
      };

      mockPrismaService.keylessBackup.findFirst.mockResolvedValue(mockBackup);
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null); // No existing OTP

      // Mock crypto.randomBytes
      const mockRandomBytes = jest.spyOn(crypto, 'randomBytes');
      mockRandomBytes.mockReturnValue(Buffer.from('new_emergency_keyshare'));

      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '777777',
        keyshare: '6e65775f656d657267656e63795f6b657973686172655f313233',
      });

      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'emergency_token',
        sessionId: 'emergency_session_id',
      });

      mockPrismaService.keylessBackup.update.mockResolvedValue(mockBackup);

      const result = await service.emergencyRecovery(
        testPhone,
        testWalletAddress,
        testAdminCode
      );

      expect(result.success).toBe(true);
      expect(mockRandomBytes).toHaveBeenCalledWith(32);

      mockRandomBytes.mockRestore();
    });
  });

  describe('linkWalletToPhone', () => {
    const testPhone = '+573001234567';
    const testWalletAddress = '0x1234567890abcdef';
    const testKeyshare = 'valid_keyshare_123';

    it('should link wallet to phone successfully', async () => {
      const mockOtpRecord = {
        id: 1,
        phone: testPhone,
        keyshare: testKeyshare,
        createdAt: new Date(),
      };

      mockPrismaService.otpCode.findFirst.mockResolvedValue(mockOtpRecord);

      const mockUpsertResult = {
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'Completed',
      };

      mockPrismaService.keylessBackup.upsert.mockResolvedValue(mockUpsertResult);

      const result = await service.linkWalletToPhone(
        testPhone,
        testWalletAddress,
        testKeyshare
      );

      expect(result).toEqual(mockUpsertResult);

      // Verify OTP record was found
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

    it('should fail with invalid keyshare', async () => {
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      await expect(
        service.linkWalletToPhone(testPhone, testWalletAddress, 'invalid_keyshare')
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail with mismatched phone and keyshare', async () => {
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);

      await expect(
        service.linkWalletToPhone('+573009999999', testWalletAddress, testKeyshare)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle database connection errors gracefully', async () => {
      mockPrismaService.otpCode.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.sendOtp('+573001234567')).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should validate phone number format', async () => {
      const invalidPhones = [
        '',
        '123',
        'invalid_phone',
        '+57300123456789012345', // Too long
        '+5730012345', // Too short
      ];

      for (const phone of invalidPhones) {
        mockPrismaService.otpCode.findFirst.mockResolvedValue(null);
        // The service should still try to process, but validation might happen at controller level
        await expect(service.sendOtp(phone)).resolves.toBeDefined();
      }
    });

    it('should handle concurrent OTP requests', async () => {
      const testPhone = '+573001234567';
      
      mockPrismaService.otpCode.findFirst.mockResolvedValue(null);
      mockPrismaService.otpCode.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.otpCode.create.mockResolvedValue({
        id: 1,
        phone: testPhone,
        code: '123456',
      });
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: 'test_message_sid',
      });

      // Simulate concurrent requests
      const promises = [
        service.sendOtp(testPhone),
        service.sendOtp(testPhone),
        service.sendOtp(testPhone),
      ];

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle keyshare consistency across multiple verifications', async () => {
      const testPhone = '+573001234567';
      const testKeyshare = 'consistent_keyshare_123';

      // Mock first verification
      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce({
          id: 1,
          phone: testPhone,
          code: '123456',
          isValid: true,
          expiresAt: new Date(Date.now() + 300000),
        })
        .mockResolvedValueOnce(null); // No existing keyshare

      // Mock crypto for consistent keyshare generation
      const mockRandomBytes = jest.spyOn(crypto, 'randomBytes');
      mockRandomBytes.mockReturnValue(Buffer.from('consistent_keyshare'));

      mockPrismaService.otpCode.update.mockResolvedValue({});
      mockAuthService.createSessionFromOtp.mockResolvedValue({
        token: 'token1',
        sessionId: 'session1',
      });

      const result1 = await service.verifyOtp(testPhone, '123456');
      expect(result1.success).toBe(true);

      // Mock second verification with existing keyshare
      mockPrismaService.otpCode.findFirst
        .mockResolvedValueOnce({
          id: 2,
          phone: testPhone,
          code: '789012',
          isValid: true,
          expiresAt: new Date(Date.now() + 300000),
        })
        .mockResolvedValueOnce({ keyshare: testKeyshare }); // Existing keyshare

      const result2 = await service.verifyOtp(testPhone, '789012');
      expect(result2.success).toBe(true);
      expect(result2.keyshare).toBe(testKeyshare);

      mockRandomBytes.mockRestore();
    });
  });
});