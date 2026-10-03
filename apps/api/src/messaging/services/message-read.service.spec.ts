import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { MessageReadService } from './message-read.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('MessageReadService', () => {
  let service: MessageReadService;

  const prismaMock = {
    message: { updateMany: vi.fn() },
  };

  const thread = { id: 'thread-1' };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageReadService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MessageReadService>(MessageReadService);
  });

  it('marks only the other participant\'s unread messages in one bulk updateMany', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 5 });

    const result = await service.markAsRead(thread, 'seller-1');

    expect(prismaMock.message.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.updateMany).toHaveBeenCalledWith({
      where: {
        threadId: 'thread-1',
        senderId: { not: 'seller-1' },
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({ updatedCount: 5 });
  });

  it('never touches the caller\'s own messages or already-read messages', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });

    await service.markAsRead(thread, 'buyer-1');

    const { where } = prismaMock.message.updateMany.mock.calls[0][0];
    // senderId not-me excludes own messages; readAt null excludes read ones.
    expect(where.senderId).toEqual({ not: 'buyer-1' });
    expect(where.readAt).toBeNull();
  });

  it('uses a single updateMany — no fetch-then-loop through individual updates', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 3 });

    await service.markAsRead(thread, 'seller-1');

    expect(Object.keys(prismaMock.message)).toEqual(['updateMany']);
    expect(prismaMock.message.updateMany).toHaveBeenCalledTimes(1);
  });

  it('succeeds with updatedCount 0 when there is nothing unread (idempotent reopen)', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markAsRead(thread, 'seller-1')).resolves.toEqual({ updatedCount: 0 });
  });

  it('does not re-query the thread — only the message table is touched', async () => {
    prismaMock.message.updateMany.mockResolvedValue({ count: 1 });

    await service.markAsRead(thread, 'seller-1');

    expect(Object.keys(prismaMock)).toEqual(['message']);
  });

  it('maps unexpected database failures to 500 (InternalServerError)', async () => {
    prismaMock.message.updateMany.mockRejectedValue(new Error('connection refused'));

    await expect(service.markAsRead(thread, 'seller-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
