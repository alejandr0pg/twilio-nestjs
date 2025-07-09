import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { OtpService } from '../otp/otp.service';
import { KeylessBackupService } from '../keyless-backup/keyless-backup.service';
import { AuthService } from '../auth/auth.service';

describe('Keyless Backup Flow Integration', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let otpService: OtpService;
  let keylessBackupService: KeylessBackupService;
  let authService: AuthService;

  const testPhone = '+573001234567';
  const testWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';
  const testEncryptedMnemonic = 'encrypted_mnemonic_test_123';
  const testEncryptionAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
  const testClientId = 'test_client';
  const testApiKey = 'test_api_key';
  const testEmergencyCode = 'test_emergency_code';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    otpService = moduleFixture.get<OtpService>(OtpService);
    keylessBackupService = moduleFixture.get<KeylessBackupService>(KeylessBackupService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Setup test client
    await prismaService.client.create({
      data: {
        clientId: testClientId,
        name: 'Test Client',
        appVersion: '1.0.0',
        apiKey: testApiKey,
        isActive: true,
      },
    });

    // Set environment variable for emergency recovery
    process.env.EMERGENCY_RECOVERY_CODE = testEmergencyCode;
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.otpCode.deleteMany({
      where: { phone: testPhone },
    });
    await prismaService.keylessBackup.deleteMany({
      where: { walletAddress: testWalletAddress },
    });
    await prismaService.siweSession.deleteMany({
      where: { address: testPhone },
    });
    await prismaService.client.deleteMany({
      where: { clientId: testClientId },
    });

    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await prismaService.otpCode.deleteMany({
      where: { phone: testPhone },
    });
    await prismaService.keylessBackup.deleteMany({
      where: { walletAddress: testWalletAddress },
    });
    await prismaService.siweSession.deleteMany({
      where: { address: testPhone },
    });
  });

  describe('Complete Keyless Backup Flow', () => {
    it('should complete full backup and recovery flow', async () => {
      // Step 1: Create keyless backup
      const createBackupResponse = await request(app.getHttpServer())
        .post('/keyless-backup')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          encryptedMnemonic: testEncryptedMnemonic,
          encryptionAddress: testEncryptionAddress,
          phone: testPhone,
        })
        .expect(201);

      expect(createBackupResponse.body).toEqual({
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'NotStarted',
        flow: null,
        origin: null,
      });

      // Step 2: Send OTP
      const sendOtpResponse = await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone })
        .expect(200);

      expect(sendOtpResponse.body).toEqual({
        success: true,
        message: 'Código OTP enviado correctamente',
      });

      // Step 3: Get OTP code from database (simulate receiving SMS)
      const otpRecord = await prismaService.otpCode.findFirst({
        where: { phone: testPhone, isValid: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(otpRecord).toBeDefined();
      expect(otpRecord.code).toMatch(/^\\d{6}$/);

      // Step 4: Verify OTP
      const verifyOtpResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: otpRecord.code,
        })
        .expect(200);

      expect(verifyOtpResponse.body).toEqual({
        success: true,
        message: 'Código OTP verificado correctamente',
        token: expect.any(String),
        keyshare: expect.any(String),
        sessionId: expect.any(String),
      });

      const { keyshare, sessionId } = verifyOtpResponse.body;

      // Step 5: Link wallet to phone
      const linkWalletResponse = await request(app.getHttpServer())
        .post('/keyless-backup/link-wallet')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          walletAddress: testWalletAddress,
          keyshare,
          sessionId,
        })
        .expect(200);

      expect(linkWalletResponse.body).toEqual({
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'Completed',
        encryptedMnemonic: null,
        encryptionAddress: null,
        flow: null,
        origin: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Step 6: Simulate recovery - send new OTP
      const recoveryOtpResponse = await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone })
        .expect(200);

      expect(recoveryOtpResponse.body.success).toBe(true);

      // Step 7: Get new OTP code
      const newOtpRecord = await prismaService.otpCode.findFirst({
        where: { phone: testPhone, isValid: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(newOtpRecord).toBeDefined();
      expect(newOtpRecord.keyshare).toBe(keyshare); // Should reuse same keyshare

      // Step 8: Verify new OTP for recovery
      const verifyRecoveryResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: newOtpRecord.code,
        })
        .expect(200);

      expect(verifyRecoveryResponse.body).toEqual({
        success: true,
        message: 'Código OTP verificado correctamente',
        token: expect.any(String),
        keyshare: keyshare, // Should be the same keyshare
        sessionId: expect.any(String),
      });

      // Step 9: Retrieve backup
      const retrieveBackupResponse = await request(app.getHttpServer())
        .get(`/keyless-backup/${testPhone}`)
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .expect(200);

      expect(retrieveBackupResponse.body).toEqual({
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        walletAddress: testWalletAddress,
        phone: testPhone,
        status: 'Completed',
        flow: null,
        origin: null,
      });
    });

    it('should handle emergency recovery flow', async () => {
      // Step 1: Create backup first
      await keylessBackupService.create(testWalletAddress, {
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        phone: testPhone,
      });

      // Step 2: Create initial OTP to establish keyshare
      const initialOtpResponse = await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone })
        .expect(200);

      const initialOtpRecord = await prismaService.otpCode.findFirst({
        where: { phone: testPhone, isValid: true },
        orderBy: { createdAt: 'desc' },
      });

      const verifyInitialResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: initialOtpRecord.code,
        })
        .expect(200);

      const originalKeyshare = verifyInitialResponse.body.keyshare;

      // Step 3: Simulate emergency recovery
      const emergencyRecoveryResponse = await request(app.getHttpServer())
        .post('/otp/emergency-recovery')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          walletAddress: testWalletAddress,
          adminCode: testEmergencyCode,
        })
        .expect(200);

      expect(emergencyRecoveryResponse.body).toEqual({
        success: true,
        message: 'Emergency recovery OTP created successfully',
        keyshare: originalKeyshare, // Should reuse existing keyshare
        token: expect.any(String),
        sessionId: expect.any(String),
      });

      // Step 4: Verify emergency OTP code exists
      const emergencyOtpRecord = await prismaService.otpCode.findFirst({
        where: { 
          phone: testPhone, 
          code: '777777', 
          isValid: true,
          isEmergency: true 
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(emergencyOtpRecord).toBeDefined();
      expect(emergencyOtpRecord.keyshare).toBe(originalKeyshare);

      // Step 5: Use emergency code for recovery
      const emergencyVerifyResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: '777777',
        })
        .expect(200);

      expect(emergencyVerifyResponse.body).toEqual({
        success: true,
        message: 'Código OTP verificado correctamente',
        token: expect.any(String),
        keyshare: originalKeyshare,
        sessionId: expect.any(String),
      });

      // Step 6: Verify backup status was updated
      const backupAfterEmergency = await prismaService.keylessBackup.findFirst({
        where: { walletAddress: testWalletAddress },
      });

      expect(backupAfterEmergency.status).toBe('Emergency_Recovery');
    });

    it('should handle concurrent OTP requests without keyshare conflicts', async () => {
      // Step 1: Create backup
      await keylessBackupService.create(testWalletAddress, {
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        phone: testPhone,
      });

      // Step 2: Send multiple OTP requests concurrently
      const otpPromises = [
        request(app.getHttpServer())
          .post('/otp/send')
          .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
          .send({ phone: testPhone }),
        request(app.getHttpServer())
          .post('/otp/send')
          .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
          .send({ phone: testPhone }),
        request(app.getHttpServer())
          .post('/otp/send')
          .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
          .send({ phone: testPhone }),
      ];

      const otpResponses = await Promise.all(otpPromises);

      // All should succeed
      otpResponses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Step 3: Verify only one valid OTP exists
      const validOtps = await prismaService.otpCode.findMany({
        where: { phone: testPhone, isValid: true },
      });

      expect(validOtps).toHaveLength(1);

      // Step 4: Verify the OTP can be used for recovery
      const verifyResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: validOtps[0].code,
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.keyshare).toBeDefined();
    });
  });

  describe('Error Handling in Full Flow', () => {
    it('should handle invalid phone numbers throughout flow', async () => {
      const invalidPhone = 'invalid_phone';

      // Should fail at OTP send
      const otpResponse = await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: invalidPhone })
        .expect(400);

      expect(otpResponse.body.message).toContain('phone');
    });

    it('should handle expired sessions', async () => {
      // Create a session that expires immediately
      const expiredSession = await prismaService.siweSession.create({
        data: {
          id: 'expired_session_123',
          address: testPhone,
          chainId: 0,
          message: 'OTP Authentication',
          signature: 'test_keyshare',
          expirationTime: new Date(Date.now() - 1000), // 1 second ago
        },
      });

      // Try to use expired session
      const linkResponse = await request(app.getHttpServer())
        .post('/keyless-backup/link-wallet')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          walletAddress: testWalletAddress,
          keyshare: 'test_keyshare',
          sessionId: expiredSession.id,
        })
        .expect(401);

      expect(linkResponse.body.message).toContain('expired');
    });

    it('should handle invalid emergency codes', async () => {
      const invalidEmergencyResponse = await request(app.getHttpServer())
        .post('/otp/emergency-recovery')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          walletAddress: testWalletAddress,
          adminCode: 'invalid_code',
        })
        .expect(400);

      expect(invalidEmergencyResponse.body.message).toContain('Invalid admin code');
    });
  });

  describe('Keyshare Consistency Edge Cases', () => {
    it('should maintain keyshare consistency across multiple recovery attempts', async () => {
      // Create backup and establish keyshare
      await keylessBackupService.create(testWalletAddress, {
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        phone: testPhone,
      });

      // First OTP verification to establish keyshare
      await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone });

      const firstOtp = await prismaService.otpCode.findFirst({
        where: { phone: testPhone, isValid: true },
        orderBy: { createdAt: 'desc' },
      });

      const firstVerifyResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: firstOtp.code,
        });

      const originalKeyshare = firstVerifyResponse.body.keyshare;

      // Multiple recovery attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/otp/send')
          .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
          .send({ phone: testPhone });

        const otpRecord = await prismaService.otpCode.findFirst({
          where: { phone: testPhone, isValid: true },
          orderBy: { createdAt: 'desc' },
        });

        const verifyResponse = await request(app.getHttpServer())
          .post('/otp/verify')
          .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
          .send({
            phone: testPhone,
            code: otpRecord.code,
          });

        expect(verifyResponse.body.keyshare).toBe(originalKeyshare);
      }
    });

    it('should handle emergency codes not interfering with normal OTPs', async () => {
      // Create backup and establish keyshare
      await keylessBackupService.create(testWalletAddress, {
        encryptedMnemonic: testEncryptedMnemonic,
        encryptionAddress: testEncryptionAddress,
        phone: testPhone,
      });

      // Normal OTP flow
      await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone });

      const normalOtp = await prismaService.otpCode.findFirst({
        where: { phone: testPhone, isValid: true, isEmergency: false },
        orderBy: { createdAt: 'desc' },
      });

      const normalVerifyResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: normalOtp.code,
        });

      const originalKeyshare = normalVerifyResponse.body.keyshare;

      // Create emergency recovery
      await request(app.getHttpServer())
        .post('/otp/emergency-recovery')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          walletAddress: testWalletAddress,
          adminCode: testEmergencyCode,
        });

      // Send new normal OTP
      await request(app.getHttpServer())
        .post('/otp/send')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({ phone: testPhone });

      // Both normal and emergency OTPs should be valid
      const allValidOtps = await prismaService.otpCode.findMany({
        where: { phone: testPhone, isValid: true },
      });

      expect(allValidOtps).toHaveLength(2);
      expect(allValidOtps.some(otp => otp.isEmergency)).toBe(true);
      expect(allValidOtps.some(otp => !otp.isEmergency)).toBe(true);

      // Emergency OTP should still work
      const emergencyVerifyResponse = await request(app.getHttpServer())
        .post('/otp/verify')
        .set('Authorization', `Bearer ${authService.generateClientToken(testClientId, '1.0.0')}`)
        .send({
          phone: testPhone,
          code: '777777',
        });

      expect(emergencyVerifyResponse.body.keyshare).toBe(originalKeyshare);
    });
  });
});