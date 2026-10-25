import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ThreadParticipantGuard, isThreadParticipant } from './thread-participant.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserStatus } from '../../generated/prisma/enums.js';

describe('ThreadParticipantGuard', () => {
  let guard: ThreadParticipantGuard;

  const prismaMock = {
    thread: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  };

  const threadRow = {
    id: 'thread-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    sellerId: 'seller-1',
    unlockedAt: null,
    lastMessageAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadParticipantGuard,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    guard = module.get<ThreadParticipantGuard>(ThreadParticipantGuard);
  });

  function mockContext(userId?: string, threadId = 'thread-1'): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { sub: userId } : undefined,
          params: { id: threadId },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows the buyer participant with an ACTIVE account', async () => {
    prismaMock.thread.findUnique.mockResolvedValue(threadRow);
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });

    await expect(guard.canActivate(mockContext('buyer-1'))).resolves.toBe(true);
  });

  it('allows the seller participant with an ACTIVE account', async () => {
    prismaMock.thread.findUnique.mockResolvedValue(threadRow);
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });

    await expect(guard.canActivate(mockContext('seller-1'))).resolves.toBe(true);
  });

  it('denies a user who is neither buyer nor seller', async () => {
    prismaMock.thread.findUnique.mockResolvedValue(threadRow);
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });

    await expect(guard.canActivate(mockContext('unrelated-1'))).rejects.toThrow(ForbiddenException);
  });

  it('denies a suspended participant (JWT allows suspended users)', async () => {
    prismaMock.thread.findUnique.mockResolvedValue(threadRow);
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.SUSPENDED });

    await expect(guard.canActivate(mockContext('buyer-1'))).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the thread does not exist', async () => {
    prismaMock.thread.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(mockContext('buyer-1'))).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when no authenticated user is present', async () => {
    await expect(guard.canActivate(mockContext(undefined))).rejects.toThrow(ForbiddenException);
  });
});

describe('isThreadParticipant', () => {
  const thread = { buyerId: 'buyer-1', sellerId: 'seller-1' };

  it('returns true for the buyer and seller, false for anyone else', () => {
    expect(isThreadParticipant(thread, 'buyer-1')).toBe(true);
    expect(isThreadParticipant(thread, 'seller-1')).toBe(true);
    expect(isThreadParticipant(thread, 'unrelated-1')).toBe(false);
  });
});