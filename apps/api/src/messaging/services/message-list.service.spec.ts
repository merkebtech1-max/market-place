import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { MessageListService } from './message-list.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { decodeMessageCursor, encodeMessageCursor } from '../pagination/message-cursor.js';

describe('MessageListService', () => {
  let service: MessageListService;

  const prismaMock = {
    message: { findMany: vi.fn() },
  };

  const thread = { id: 'thread-1' };

  /** Row factory: newest-first ids/msg-N with descending timestamps. */
  function makeRows(count: number, startId = 100) {
    const base = Date.parse('2026-09-01T00:00:00.000Z');
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${startId - i}`,
      threadId: 'thread-1',
      senderId: 'buyer-1',
      body: `body ${startId - i}`,
      type: 'TEXT',
      wasRedacted: false,
      // 1ms apart so ordering is deterministic in the fixture.
      createdAt: new Date(base - i * 1000),
    }));
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageListService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MessageListService>(MessageListService);
  });

  it('defaults to a fresh-page query: threadId filter, no cursor filter, take limit + 1', async () => {
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.getMessages(thread, { limit: 30 });

    expect(prismaMock.message.findMany).toHaveBeenCalledWith({
      where: { threadId: 'thread-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 31,
      select: expect.any(Object),
    });
  });

  it('never selects internal moderation fields (originalBody, violations, matchedText)', async () => {
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.getMessages(thread, { limit: 30 });

    const { select } = prismaMock.message.findMany.mock.calls[0][0];
    expect(Object.keys(select).sort()).toEqual(
      ['body', 'createdAt', 'id', 'senderId', 'threadId', 'type', 'wasRedacted'].sort(),
    );
    expect(select).not.toHaveProperty('originalBody');
    expect(select).not.toHaveProperty('contactViolations');
    expect(select).not.toHaveProperty('readAt');
  });

  it('returns newest messages first and reports hasNextPage=true with a decodable cursor when limit + 1 rows come back', async () => {
    // 31 rows for limit=30: the 31st only proves an older page exists.
    const rows = makeRows(31);
    prismaMock.message.findMany.mockResolvedValue(rows);

    const page = await service.getMessages(thread, { limit: 30 });

    // Only the first 30 are returned; the peek row is discarded.
    expect(page.messages).toHaveLength(30);
    expect(page.messages[0].id).toBe('msg-100');
    expect(page.messages[29].id).toBe('msg-71');
    expect(page.pagination.hasNextPage).toBe(true);

    // The cursor points at the last RETURNED message, not the discarded row.
    expect(page.pagination.nextCursor).not.toBeNull();
    const cursor = decodeMessageCursor(page.pagination.nextCursor as string);
    expect(cursor.id).toBe('msg-71');
    expect(cursor.createdAt).toEqual(rows[29].createdAt);
  });

  it('returns hasNextPage=false and nextCursor=null when no older page exists', async () => {
    prismaMock.message.findMany.mockResolvedValue(makeRows(30));

    const page = await service.getMessages(thread, { limit: 30 });

    expect(page.messages).toHaveLength(30);
    expect(page.pagination).toEqual({ nextCursor: null, hasNextPage: false });
  });

  it('returns an empty page for an empty thread without any special error', async () => {
    prismaMock.message.findMany.mockResolvedValue([]);

    const page = await service.getMessages(thread, { limit: 30 });

    expect(page).toEqual({
      messages: [],
      pagination: { nextCursor: null, hasNextPage: false },
    });
  });

  it('encodes the cursor as opaque Base64, not raw fields', async () => {
    const rows = makeRows(31);
    prismaMock.message.findMany.mockResolvedValue(rows);

    const page = await service.getMessages(thread, { limit: 30 });

    const nextCursor = page.pagination.nextCursor as string;
    expect(nextCursor).not.toContain('msg-');
    expect(nextCursor).not.toContain('createdAt');
    expect(nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    // Round-trips back to the same position.
    expect(encodeMessageCursor(decodeMessageCursor(nextCursor))).toBe(nextCursor);
  });

  it('filters continuation with the (createdAt, id) pair: older timestamp OR same timestamp + smaller id', async () => {
    prismaMock.message.findMany.mockResolvedValue([]);

    const createdAt = new Date('2026-09-01T00:00:00.000Z');
    const cursor = encodeMessageCursor({ createdAt, id: 'msg-71' });
    await service.getMessages(thread, { limit: 30, cursor });

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          threadId: 'thread-1',
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: 'msg-71' } },
          ],
        },
      }),
    );
  });

  it('does not re-query the thread — only the message table is touched', async () => {
    prismaMock.message.findMany.mockResolvedValue([]);

    await service.getMessages(thread, { limit: 30 });

    expect(prismaMock).not.toHaveProperty('thread');
    expect(Object.keys(prismaMock)).toEqual(['message']);
  });

  it('rejects a malformed cursor with 400 before any query reaches Prisma', async () => {
    await expect(
      service.getMessages(thread, { limit: 30, cursor: 'not-base64-json{{' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it('rejects a well-encoded cursor with the wrong shape with 400', async () => {
    // Valid Base64 JSON, but missing fields the cursor must carry.
    const bogus = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8').toString('base64url');

    await expect(
      service.getMessages(thread, { limit: 30, cursor: bogus }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.message.findMany).not.toHaveBeenCalled();
  });

  it('maps unexpected database failures to 500 (InternalServerError), not 400', async () => {
    prismaMock.message.findMany.mockRejectedValue(new Error('connection refused'));

    await expect(service.getMessages(thread, { limit: 30 })).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
