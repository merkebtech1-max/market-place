import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MessageCreateService } from './message-create.service.js';
import { ContactInfoService } from './contact-info.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MessageType, ViolationPatternType } from '../../generated/prisma/enums.js';
import { MESSAGE_MAX_LENGTH } from '../dto/create-message.dto.js';

describe('MessageCreateService', () => {
  let service: MessageCreateService;

  const prismaMock = {
    message: { create: vi.fn() },
    contactInfoViolation: { createMany: vi.fn() },
    thread: { update: vi.fn() },
    $transaction: vi.fn(),
  };

  const contactInfoMock = { inspect: vi.fn() };

  const createdMessage = {
    id: 'message-1',
    threadId: 'thread-1',
    senderId: 'buyer-1',
    body: 'Is this still available?',
    type: 'TEXT',
    wasRedacted: false,
    createdAt: new Date(),
  };

  const thread = { id: 'thread-1', unlockedAt: null };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageCreateService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ContactInfoService, useValue: contactInfoMock },
      ],
    }).compile();

    service = module.get<MessageCreateService>(MessageCreateService);

    // $transaction runs the callback against a tx alias of the mocked client.
    prismaMock.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) => callback(prismaMock));

    contactInfoMock.inspect.mockReturnValue({ safe: true, body: 'Is this still available?', violations: [] });
  });

  it('creates a TEXT message and bumps lastMessageAt in one transaction', async () => {
    prismaMock.message.create.mockResolvedValue(createdMessage);
    prismaMock.thread.update.mockResolvedValue({});

    await expect(service.createMessage(thread, 'buyer-1', '  Is this still available?  ')).resolves.toEqual(createdMessage);

    expect(contactInfoMock.inspect).toHaveBeenCalledWith(thread, 'Is this still available?');
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        senderId: 'buyer-1',
        body: 'Is this still available?',
        originalBody: null,
        type: MessageType.TEXT,
        wasRedacted: false,
      },
      select: expect.any(Object),
    });
    expect(prismaMock.contactInfoViolation.createMany).not.toHaveBeenCalled();
    expect(prismaMock.thread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { lastMessageAt: createdMessage.createdAt },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a whitespace-only body after trimming', async () => {
    await expect(service.createMessage(thread, 'buyer-1', '   \t  ')).rejects.toThrow(BadRequestException);
    expect(contactInfoMock.inspect).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
    expect(prismaMock.thread.update).not.toHaveBeenCalled();
  });

  it('rejects a body longer than the max length', async () => {
    await expect(service.createMessage(thread, 'buyer-1', 'a'.repeat(MESSAGE_MAX_LENGTH + 1))).rejects.toThrow(BadRequestException);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it('uses the threadId from the authorized thread and senderId from the caller', async () => {
    prismaMock.message.create.mockResolvedValue(createdMessage);
    prismaMock.thread.update.mockResolvedValue({});
    contactInfoMock.inspect.mockReturnValue({ safe: true, body: 'hello', violations: [] });

    await service.createMessage({ id: 'other-thread-9', unlockedAt: null }, 'seller-9', 'hello');
    expect(prismaMock.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ threadId: 'other-thread-9', senderId: 'seller-9' }),
      }),
    );
  });

  it('stores the redacted body and records ContactInfoViolations when protection fires', async () => {
    const redactedMessage = {
      ...createdMessage,
      body: `Call me at [contact information removed]`,
      wasRedacted: true,
    };
    prismaMock.message.create.mockResolvedValue(redactedMessage);
    prismaMock.contactInfoViolation.createMany.mockResolvedValue({ count: 1 });
    prismaMock.thread.update.mockResolvedValue({});

    contactInfoMock.inspect.mockReturnValue({
      safe: false,
      body: 'Call me at [contact information removed]',
      violations: [{ patternType: ViolationPatternType.PHONE_NUMBER, matchedText: '0912345678' }],
    });

    const result = await service.createMessage(thread, 'buyer-1', 'Call me at 0912345678');

    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: 'Call me at [contact information removed]',
        originalBody: 'Call me at 0912345678',
        wasRedacted: true,
      }),
      select: expect.any(Object),
    });
    expect(prismaMock.contactInfoViolation.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'buyer-1',
          threadId: 'thread-1',
          messageId: 'message-1',
          patternType: ViolationPatternType.PHONE_NUMBER,
          matchedText: '0912345678',
        },
      ],
    });
    expect(prismaMock.thread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: { lastMessageAt: redactedMessage.createdAt },
    });
    expect(result).toEqual(redactedMessage);
  });

  it('stores the message verbatim for an unlocked thread', async () => {
    prismaMock.message.create.mockResolvedValue(createdMessage);
    prismaMock.thread.update.mockResolvedValue({});

    const unlockedThread = { id: 'thread-1', unlockedAt: new Date('2026-01-01') };
    await service.createMessage(unlockedThread, 'buyer-1', 'Call 0912345678');

    expect(contactInfoMock.inspect).toHaveBeenCalledWith(unlockedThread, 'Call 0912345678');
  });

  it('maps unexpected database failures to 500 (InternalServerError), not 400', async () => {
    prismaMock.message.create.mockRejectedValue(new Error('connection refused'));

    await expect(service.createMessage(thread, 'buyer-1', 'hello')).rejects.toThrow(InternalServerErrorException);
    expect(prismaMock.thread.update).not.toHaveBeenCalled();
  });
});