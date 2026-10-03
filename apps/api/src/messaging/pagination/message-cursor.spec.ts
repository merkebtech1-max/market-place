import { BadRequestException } from '@nestjs/common';
import { decodeMessageCursor, encodeMessageCursor } from './message-cursor.js';

describe('message cursor', () => {
  const cursor = {
    createdAt: new Date('2026-09-01T12:34:56.789Z'),
    id: 'msg-71',
  };

  it('round-trips createdAt and id through encode/decode', () => {
    const encoded = encodeMessageCursor(cursor);
    expect(decodeMessageCursor(encoded)).toEqual(cursor);
  });

  it('produces a URL-safe token with no raw field names inside', () => {
    const encoded = encodeMessageCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
    expect(encoded).not.toContain('createdAt');
    expect(encoded).not.toContain('msg-71');
  });

  it('preserves millisecond precision so same-timestamp tie-breaking stays exact', () => {
    const same = new Date('2026-09-01T00:00:00.123Z');
    expect(decodeMessageCursor(encodeMessageCursor({ createdAt: same, id: 'a' })).createdAt)
      .toEqual(same);
  });

  it.each([
    ['an empty string', ''],
    ['random garbage', 'not-a-cursor!!'],
    ['Base64 of non-JSON', Buffer.from('just a string', 'utf8').toString('base64url')],
    ['JSON missing id', Buffer.from(JSON.stringify({ createdAt: '2026-09-01T00:00:00.000Z' }), 'utf8').toString('base64url')],
    ['JSON missing createdAt', Buffer.from(JSON.stringify({ id: 'msg-1' }), 'utf8').toString('base64url')],
    ['JSON with an empty id', Buffer.from(JSON.stringify({ createdAt: '2026-09-01T00:00:00.000Z', id: '' }), 'utf8').toString('base64url')],
    ['an unparseable date', Buffer.from(JSON.stringify({ createdAt: 'not-a-date', id: 'msg-1' }), 'utf8').toString('base64url')],
    ['a non-object payload', Buffer.from(JSON.stringify(42), 'utf8').toString('base64url')],
    ['a null payload', Buffer.from(JSON.stringify(null), 'utf8').toString('base64url')],
    ['wrong value types', Buffer.from(JSON.stringify({ createdAt: 123, id: 456 }), 'utf8').toString('base64url')],
  ])('rejects %s with 400', (_label, invalid) => {
    expect(() => decodeMessageCursor(invalid)).toThrow(BadRequestException);
  });
});
