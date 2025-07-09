import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let prismaService: PrismaService;

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
    },
    siweSession: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('validateClient', () => {
    const testClientId = 'test_client_123';
    const testApiKey = 'test_api_key_456';

    it('should validate client successfully', async () => {
      const mockClient = {
        id: 1,
        clientId: testClientId,
        name: 'Test Client',
        appVersion: '1.0.0',
        apiKey: testApiKey,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);

      const result = await service.validateClient(testClientId, testApiKey);

      expect(result).toEqual(mockClient);
      expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: testClientId,
          apiKey: testApiKey,
          isActive: true,
        },
      });
    });

    it('should return null for invalid client', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const result = await service.validateClient(testClientId, 'invalid_api_key');

      expect(result).toBeNull();
      expect(mockPrismaService.client.findFirst).toHaveBeenCalledWith({
        where: {
          clientId: testClientId,
          apiKey: 'invalid_api_key',
          isActive: true,
        },
      });
    });

    it('should return null for inactive client', async () => {
      const inactiveClient = {
        id: 1,
        clientId: testClientId,
        name: 'Test Client',
        appVersion: '1.0.0',
        apiKey: testApiKey,
        isActive: false, // Inactive client
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not find inactive client
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const result = await service.validateClient(testClientId, testApiKey);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.client.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(service.validateClient(testClientId, testApiKey)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle empty/null parameters', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      const result1 = await service.validateClient('', testApiKey);
      const result2 = await service.validateClient(testClientId, '');
      const result3 = await service.validateClient(null, testApiKey);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });
  });

  describe('generateAccessToken', () => {
    const testPhone = '+573001234567';

    it('should generate access token for phone', () => {
      const mockToken = 'mock_jwt_token_123';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateAccessToken(testPhone);

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ phone: testPhone });
    });

    it('should handle empty phone number', () => {
      const mockToken = 'mock_jwt_token_empty';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateAccessToken('');

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ phone: '' });
    });

    it('should handle JWT service errors', () => {
      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => service.generateAccessToken(testPhone)).toThrow(
        'JWT signing failed'
      );
    });
  });

  describe('generateClientToken', () => {
    const testClientId = 'test_client_123';
    const testAppVersion = '1.0.0';

    it('should generate client token', () => {
      const mockToken = 'mock_client_token_123';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateClientToken(testClientId, testAppVersion);

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        clientId: testClientId,
        appVersion: testAppVersion,
      });
    });

    it('should handle empty parameters', () => {
      const mockToken = 'mock_client_token_empty';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = service.generateClientToken('', '');

      expect(result).toBe(mockToken);
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        clientId: '',
        appVersion: '',
      });
    });

    it('should handle different app versions', () => {
      const versions = ['1.0.0', '2.1.3', '0.0.1-beta', 'latest'];
      
      versions.forEach(version => {
        const mockToken = `mock_token_${version}`;
        mockJwtService.sign.mockReturnValue(mockToken);

        const result = service.generateClientToken(testClientId, version);

        expect(result).toBe(mockToken);
        expect(mockJwtService.sign).toHaveBeenCalledWith({
          clientId: testClientId,
          appVersion: version,
        });
      });
    });
  });

  describe('createSessionFromOtp', () => {
    const testKeyshare = 'test_keyshare_123';
    const testPhone = '+573001234567';

    beforeEach(() => {
      // Mock crypto.randomUUID
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('mock_session_id_123');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create session from OTP successfully', async () => {
      const mockToken = 'mock_session_token_123';
      const mockSessionId = 'mock_session_id_123';

      mockPrismaService.siweSession.create.mockResolvedValue({
        id: mockSessionId,
        address: testPhone,
        chainId: 0,
        message: 'OTP Authentication',
        signature: testKeyshare,
        expirationTime: expect.any(Date),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.createSessionFromOtp(testKeyshare, testPhone);

      expect(result).toEqual({
        token: mockToken,
        sessionId: mockSessionId,
      });

      // Verify session was created
      expect(mockPrismaService.siweSession.create).toHaveBeenCalledWith({
        data: {
          id: mockSessionId,
          address: testPhone,
          chainId: 0,
          message: 'OTP Authentication',
          signature: testKeyshare,
          expirationTime: expect.any(Date),
        },
      });

      // Verify JWT token was generated
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: testPhone,
        clientId: testPhone,
        appVersion: '1.0.0',
        sessionId: mockSessionId,
        keyshare: testKeyshare,
      });
    });

    it('should set correct expiration time (24 hours)', async () => {
      const mockSessionId = 'mock_session_id_123';
      const mockToken = 'mock_session_token_123';

      mockPrismaService.siweSession.create.mockResolvedValue({
        id: mockSessionId,
        address: testPhone,
        chainId: 0,
        message: 'OTP Authentication',
        signature: testKeyshare,
        expirationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockJwtService.sign.mockReturnValue(mockToken);

      const beforeCreate = new Date();
      await service.createSessionFromOtp(testKeyshare, testPhone);
      const afterCreate = new Date();

      // Verify expiration time is approximately 24 hours from now
      const createCall = mockPrismaService.siweSession.create.mock.calls[0][0];
      const expirationTime = createCall.data.expirationTime;
      
      const expectedMinExpiration = new Date(beforeCreate.getTime() + 23.5 * 60 * 60 * 1000);
      const expectedMaxExpiration = new Date(afterCreate.getTime() + 24.5 * 60 * 60 * 1000);

      expect(expirationTime).toBeInstanceOf(Date);
      expect(expirationTime.getTime()).toBeGreaterThan(expectedMinExpiration.getTime());
      expect(expirationTime.getTime()).toBeLessThan(expectedMaxExpiration.getTime());
    });

    it('should handle database errors during session creation', async () => {
      mockPrismaService.siweSession.create.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        service.createSessionFromOtp(testKeyshare, testPhone)
      ).rejects.toThrow('Database connection failed');

      expect(mockJwtService.sign).not.toHaveBeenCalled();
    });

    it('should handle JWT generation errors', async () => {
      const mockSessionId = 'mock_session_id_123';

      mockPrismaService.siweSession.create.mockResolvedValue({
        id: mockSessionId,
        address: testPhone,
        chainId: 0,
        message: 'OTP Authentication',
        signature: testKeyshare,
        expirationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockJwtService.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      await expect(
        service.createSessionFromOtp(testKeyshare, testPhone)
      ).rejects.toThrow('JWT signing failed');
    });

    it('should handle different keyshare formats', async () => {
      const keyshares = [
        'simple_keyshare',
        'a1b2c3d4e5f6',
        'very_long_keyshare_with_special_chars_123!@#',
        '',
        'hex_keyshare_4630e112ff4f06360a6b9e540f614f048e9b9ee389b1694ff588b1a999be6950',
      ];

      for (const keyshare of keyshares) {
        const mockSessionId = `mock_session_${keyshare}`;
        const mockToken = `mock_token_${keyshare}`;

        jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockSessionId);

        mockPrismaService.siweSession.create.mockResolvedValue({
          id: mockSessionId,
          address: testPhone,
          chainId: 0,
          message: 'OTP Authentication',
          signature: keyshare,
          expirationTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        mockJwtService.sign.mockReturnValue(mockToken);

        const result = await service.createSessionFromOtp(keyshare, testPhone);

        expect(result).toEqual({
          token: mockToken,
          sessionId: mockSessionId,
        });

        expect(mockJwtService.sign).toHaveBeenCalledWith({
          sub: testPhone,
          clientId: testPhone,
          appVersion: '1.0.0',
          sessionId: mockSessionId,
          keyshare: keyshare,
        });
      }
    });

    it('should handle different phone number formats', async () => {
      const phones = [
        '+573001234567',
        '+1234567890',
        '+5511999999999',
        '+442071234567',
        '',
        'invalid_phone',
      ];

      for (const phone of phones) {
        const mockSessionId = `mock_session_${phone}`;
        const mockToken = `mock_token_${phone}`;

        jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockSessionId);

        mockPrismaService.siweSession.create.mockResolvedValue({
          id: mockSessionId,
          address: phone,
          chainId: 0,
          message: 'OTP Authentication',
          signature: testKeyshare,
          expirationTime: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        mockJwtService.sign.mockReturnValue(mockToken);

        const result = await service.createSessionFromOtp(testKeyshare, phone);

        expect(result).toEqual({
          token: mockToken,
          sessionId: mockSessionId,
        });

        expect(mockPrismaService.siweSession.create).toHaveBeenCalledWith({
          data: {
            id: mockSessionId,
            address: phone,
            chainId: 0,
            message: 'OTP Authentication',
            signature: testKeyshare,
            expirationTime: expect.any(Date),
          },
        });
      }
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle concurrent session creation', async () => {
      const testKeyshare = 'test_keyshare_123';
      const testPhone = '+573001234567';

      // Mock different UUIDs for each call
      jest.spyOn(crypto, 'randomUUID')
        .mockReturnValueOnce('session_1')
        .mockReturnValueOnce('session_2')
        .mockReturnValueOnce('session_3');

      mockPrismaService.siweSession.create.mockResolvedValue({
        id: 'mock_session',
        address: testPhone,
        chainId: 0,
        message: 'OTP Authentication',
        signature: testKeyshare,
        expirationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockJwtService.sign.mockReturnValue('mock_token');

      // Simulate concurrent requests
      const promises = [
        service.createSessionFromOtp(testKeyshare, testPhone),
        service.createSessionFromOtp(testKeyshare, testPhone),
        service.createSessionFromOtp(testKeyshare, testPhone),
      ];

      const results = await Promise.all(promises);

      // All should succeed with different session IDs
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.token).toBe('mock_token');
        expect(result.sessionId).toMatch(/session_\d/);
      });
    });

    it('should handle null/undefined parameters gracefully', async () => {
      mockPrismaService.siweSession.create.mockResolvedValue({
        id: 'mock_session',
        address: null,
        chainId: 0,
        message: 'OTP Authentication',
        signature: null,
        expirationTime: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockJwtService.sign.mockReturnValue('mock_token');

      const result = await service.createSessionFromOtp(null, null);

      expect(result).toEqual({
        token: 'mock_token',
        sessionId: 'mock_session_id_123',
      });
    });

    it('should validate client with various edge cases', async () => {
      // Test with special characters in clientId and apiKey
      const specialClientId = 'client@#$%^&*()';
      const specialApiKey = 'api_key!@#$%^&*()_+';

      mockPrismaService.client.findFirst.mockResolvedValue({
        id: 1,
        clientId: specialClientId,
        name: 'Special Client',
        appVersion: '1.0.0',
        apiKey: specialApiKey,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.validateClient(specialClientId, specialApiKey);

      expect(result).toBeDefined();
      expect(result.clientId).toBe(specialClientId);
      expect(result.apiKey).toBe(specialApiKey);
    });
  });
});