import { Test, TestingModule } from '@nestjs/testing';
import { CallController } from './call.controller';
import { CallService } from './services/call.service';

describe('CallController (SEC-01 & SEC-08)', () => {
  let controller: CallController;
  let mockCallService: Partial<Record<keyof CallService, jest.Mock>>;

  beforeEach(async () => {
    mockCallService = {
      getCallHistory: jest.fn().mockResolvedValue([]),
      refreshToken: jest.fn().mockResolvedValue({
        callId: 'call-123',
        channelName: 'channel_123',
        uid: 1001,
        token: 'token_abc',
        expiresAt: 1234567,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CallController],
      providers: [
        {
          provide: CallService,
          useValue: mockCallService,
        },
      ],
    }).compile();

    controller = module.get<CallController>(CallController);
  });

  describe('getCallHistory (SEC-08)', () => {
    it('should use req.user.userId from authenticated JWT session', async () => {
      const mockReq = {
        user: {
          userId: 'user-auth-uuid-123',
          sessionId: 'session-uuid-456',
        },
      };

      await controller.getCallHistory(mockReq, '25');

      expect(mockCallService.getCallHistory).toHaveBeenCalledWith(
        'user-auth-uuid-123',
        25,
      );
    });

    it('should not allow callers to access another user history via query params or body manipulation', async () => {
      const mockReq = {
        user: {
          userId: 'user-auth-uuid-123',
          sessionId: 'session-uuid-456',
        },
        query: {
          userId: 'victim-user-999',
        },
        body: {
          userId: 'victim-user-999',
        },
      };

      await controller.getCallHistory(mockReq);

      expect(mockCallService.getCallHistory).toHaveBeenCalledWith(
        'user-auth-uuid-123',
        20,
      );
      expect(mockCallService.getCallHistory).not.toHaveBeenCalledWith(
        'victim-user-999',
        expect.anything(),
      );
    });
  });

  describe('refreshToken (SEC-01)', () => {
    it('should pass req.user.userId and DTO to callService.refreshToken', async () => {
      const mockReq = {
        user: {
          userId: 'user-auth-uuid-123',
          sessionId: 'session-uuid-456',
        },
      };
      const dto = { callId: 'call-uuid-1' };

      const result = await controller.refreshToken(mockReq, dto);

      expect(mockCallService.refreshToken).toHaveBeenCalledWith(
        'user-auth-uuid-123',
        dto,
      );
      expect(result.token).toBe('token_abc');
    });
  });
});
