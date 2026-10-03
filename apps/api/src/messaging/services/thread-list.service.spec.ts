import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ThreadListService } from './thread-list.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListingStatus, UserStatus } from '../../generated/prisma/enums.js';

describe('ThreadListService', () => {
  let service: ThreadListService;

  const prismaMock = {
    user: { findUnique: vi.fn() },
    thread: { findMany: vi.fn() },
  };

  const buyer = { id: 'buyer-1', displayName: 'Buyer', avatarKey: null };
  const seller = { id: 'seller-1', displayName: 'Seller', avatarKey: null };
  const listing = {
    id: 'listing-1',
    title: 'Phone',
    priceCents: 1000,
    images: [
      { storageKey: 'img/key.jpg', width: 800, height: 600, blurhash: null, position: 0 },
    ],
  };
  const lastMessage = {
    id: 'msg-1',
    body: 'Is this still available?',
    type: 'TEXT',
    senderId: 'buyer-1',
    createdAt: new Date('2026-09-02T00:00:00Z'),
    readAt: null as Date | null,
  };

  function mockThreadRow(overrides: Partial<{ id: string; buyerId: string; sellerId: string; lastMessageAt: Date | null; messages: typeof lastMessage[] }> = {}) {
    return {
      id: 'thread-1',
      listingId: 'listing-1',
      buyerId: 'buyer-1',
      sellerId: 'seller-1',
      unlockedAt: null,
      lastMessageAt: null,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      listing,
      buyer,
      seller,
      messages: [lastMessage],
      ...overrides,
    };
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreadListService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ThreadListService>(ThreadListService);
  });

  it('queries threads the user is part of, filtered to active listings', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow()]);

    await service.getMyThreads('buyer-1');

    expect(prismaMock.thread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ buyerId: 'buyer-1' }, { sellerId: 'buyer-1' }],
          listing: {
            status: ListingStatus.ACTIVE,
            expiresAt: { gt: expect.any(Date) },
            seller: { status: UserStatus.ACTIVE },
          },
        },
        orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
    );
  });

  it('resolves the counterparty to the seller when the buyer is viewing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow()]);

    const [thread] = await service.getMyThreads('buyer-1');
    expect(thread.counterparty).toEqual(seller);
  });

  it('resolves the counterparty to the buyer when the seller is viewing', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow()]);

    const [thread] = await service.getMyThreads('seller-1');
    expect(thread.counterparty).toEqual(buyer);
  });

  it('returns the lightweight listing snapshot and the newest message preview', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow({ lastMessageAt: lastMessage.createdAt })]);

    const [thread] = await service.getMyThreads('buyer-1');
    expect(thread.listing).toEqual({
      id: 'listing-1',
      title: 'Phone',
      priceCents: 1000,
      image: listing.images[0],
    });
    expect(thread.lastMessage).toEqual(lastMessage);
    expect(thread.lastActivityAt).toEqual(lastMessage.createdAt);
  });

  it('exposes readAt on the last message so the frontend can derive the tick state', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    const readAt = new Date('2026-09-02T01:00:00Z');
    prismaMock.thread.findMany.mockResolvedValue([
      mockThreadRow({ lastMessageAt: lastMessage.createdAt, messages: [{ ...lastMessage, readAt }] }),
    ]);

    const [thread] = await service.getMyThreads('seller-1');
    expect(thread.lastMessage?.readAt).toEqual(readAt);

    // The underlying Prisma select must actually request readAt.
    const { select } = prismaMock.thread.findMany.mock.calls[0][0];
    expect(select.messages.select).toHaveProperty('readAt', true);
    // ...and still never the internal/moderation fields.
    expect(select.messages.select).not.toHaveProperty('originalBody');
  });

  it('falls back to createdAt for the activity timestamp when no message exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow({ messages: [], lastMessageAt: null })]);

    const [thread] = await service.getMyThreads('buyer-1');
    expect(thread.lastMessage).toBeNull();
    expect(thread.lastActivityAt).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  it('exposes only the public summary fields, never buyerId/sellerId/createdAt', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    prismaMock.thread.findMany.mockResolvedValue([mockThreadRow()]);

    const [thread] = await service.getMyThreads('buyer-1');
    expect(Object.keys(thread).sort()).toEqual(
      ['counterparty', 'id', 'lastActivityAt', 'lastMessage', 'listing', 'listingId', 'unlockedAt'].sort(),
    );
    expect(thread).not.toHaveProperty('buyerId');
    expect(thread).not.toHaveProperty('sellerId');
    expect(thread).not.toHaveProperty('createdAt');
  });

  it('rejects a suspended user', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ status: UserStatus.SUSPENDED });

    await expect(service.getMyThreads('buyer-1')).rejects.toThrow(ForbiddenException);
    expect(prismaMock.thread.findMany).not.toHaveBeenCalled();
  });
});