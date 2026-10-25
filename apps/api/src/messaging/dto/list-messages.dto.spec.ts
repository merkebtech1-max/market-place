import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListMessagesDto,
  MESSAGE_LIST_DEFAULT_LIMIT,
  MESSAGE_LIST_MAX_LIMIT,
} from './list-messages.dto.js';

async function validateQuery(query: Record<string, unknown>) {
  const dto = plainToInstance(ListMessagesDto, query);
  return { dto, errors: await validate(dto) };
}

describe('ListMessagesDto', () => {
  it('defaults limit to 30 when omitted', async () => {
    const { dto, errors } = await validateQuery({});
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(30);
    expect(MESSAGE_LIST_DEFAULT_LIMIT).toBe(30);
    expect(dto.cursor).toBeUndefined();
  });

  it('accepts an explicit limit', async () => {
    const { dto, errors } = await validateQuery({ limit: '10' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(10);
  });

  it('accepts the hard maximum of 50', async () => {
    const { dto, errors } = await validateQuery({ limit: '50' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(50);
    expect(MESSAGE_LIST_MAX_LIMIT).toBe(50);
  });

  it('rejects a limit above the maximum instead of clamping it', async () => {
    const { dto, errors } = await validateQuery({ limit: '100' });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('max');
    // The over-limit value is rejected, never silently rewritten to 50.
    expect(dto.limit).toBe(100);
  });

  it.each([0, -1])('rejects limit=%s', async (limit) => {
    const { errors } = await validateQuery({ limit: String(limit) });
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('min');
  });

  it('rejects a non-numeric limit', async () => {
    const { errors } = await validateQuery({ limit: 'lots' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a cursor token', async () => {
    const { dto, errors } = await validateQuery({ cursor: 'eyJpZCI6Im1zZy03MSJ9' });
    expect(errors).toHaveLength(0);
    expect(dto.cursor).toBe('eyJpZCI6Im1zZy03MSJ9');
  });

  it('accepts both parameters together', async () => {
    const { dto, errors } = await validateQuery({ limit: '25', cursor: 'abc123' });
    expect(errors).toHaveLength(0);
    expect(dto.limit).toBe(25);
    expect(dto.cursor).toBe('abc123');
  });
});
