import { ContactInfoService } from './contact-info.service.js';
import { REDACTION_PLACEHOLDER } from '../contact-info/contact-info.patterns.js';
import { ViolationPatternType } from '../../generated/prisma/enums.js';

describe('ContactInfoService', () => {
  let service: ContactInfoService;

  beforeEach(() => {
    service = new ContactInfoService();
  });

  const locked = { unlockedAt: null };

  describe('phone numbers', () => {
    it.each([
      '0912345678',
      '091 234 5678',
      '091-234-5678',
      '09 12 34 56 78',
      '+251 91 234 5678',
      '+251-91-234-5678',
      '+251912345678',
      '+251 (0) 91 234 5678',
      '(0) 91 234 5678',
    ])('detects variant "%s"', (raw) => {
      const result = service.inspect(locked, `Call me at ${raw} tomorrow`);
      expect(result.safe).toBe(false);
      expect(result.body).toBe(`Call me at ${REDACTION_PLACEHOLDER} tomorrow`);
      expect(result.violations).toEqual([
        { patternType: ViolationPatternType.PHONE_NUMBER, matchedText: raw },
      ]);
    });

    it('ignores digit runs that are not Ethiopian numbers', () => {
      const result = service.inspect(locked, 'My pin is 12345678 or maybe 1990-1995');
      expect(result.safe).toBe(true);
      expect(result.body).toBe('My pin is 12345678 or maybe 1990-1995');
      expect(result.violations).toEqual([]);
    });
  });

  it('detects an email address, redacting only the address', () => {
    const result = service.inspect(locked, 'Write to me@test.com, thanks');
    expect(result.safe).toBe(false);
    expect(result.body).toBe(`Write to ${REDACTION_PLACEHOLDER}, thanks`);
    expect(result.violations).toEqual([
      { patternType: ViolationPatternType.EMAIL, matchedText: 'me@test.com' },
    ]);
  });

  describe('telegram / handles', () => {
    it('detects a bare @username', () => {
      const result = service.inspect(locked, 'Add me on telegram @myuser');
      expect(result.safe).toBe(false);
      expect(result.body).toBe(`Add me on ${REDACTION_PLACEHOLDER} ${REDACTION_PLACEHOLDER}`);
      expect(result.violations.map((v) => v.patternType)).toEqual([
        ViolationPatternType.TELEGRAM,
        ViolationPatternType.TELEGRAM,
      ]);
    });

    it('detects t.me / telegram.me links', () => {
      for (const link of ['t.me/myuser', 'https://t.me/myuser', 'https://telegram.me/myuser']) {
        const result = service.inspect(locked, `Here: ${link}`);
        expect(result.safe).toBe(false);
        expect(result.body).toBe(`Here: ${REDACTION_PLACEHOLDER}`);
      }
    });

    it('does not mistake the @ of an email for a handle', () => {
      const result = service.inspect(locked, 'Reach me@test.com today');
      expect(result.violations).toEqual([
        { patternType: ViolationPatternType.EMAIL, matchedText: 'me@test.com' },
      ]);
    });
  });

  describe('external contact links', () => {
    it('detects WhatsApp links', () => {
      const result = service.inspect(locked, 'Ping me on wa.me/251912345678');
      expect(result.safe).toBe(false);
      expect(result.violations[0].patternType).toBe(ViolationPatternType.EXTERNAL_CONTACT);
    });

    it('detects major social links', () => {
      const result = service.inspect(locked, 'See instagram.com/mymarket');
      expect(result.safe).toBe(false);
      expect(result.violations[0].patternType).toBe(ViolationPatternType.SOCIAL_MEDIA);
    });

    it('detects bare external messenger names', () => {
      const result = service.inspect(locked, 'Let us continue on whatsapp');
      expect(result.safe).toBe(false);
      expect(result.violations[0].patternType).toBe(ViolationPatternType.EXTERNAL_CONTACT);
    });
  });

  describe('policy: explicit off-platform references are violations', () => {
    it('redacts a bare "Telegram" mention — intentional and strict', () => {
      const result = service.inspect(locked, 'Do you use Telegram?');
      expect(result.safe).toBe(false);
      expect(result.body).toBe(`Do you use ${REDACTION_PLACEHOLDER}?`);
      expect(result.violations).toEqual([
        { patternType: ViolationPatternType.TELEGRAM, matchedText: 'Telegram' },
      ]);
    });

    it.each(['whatsapp', 'viber', 'skype', 'wechat'])(
      'redacts the bare messenger name "%s"',
      (name) => {
        const result = service.inspect(locked, `Add me on ${name}`);
        expect(result.safe).toBe(false);
        expect(result.violations[0].patternType).toBe(ViolationPatternType.EXTERNAL_CONTACT);
      },
    );

    it.each([
      'instagram',
      'insta',
      'facebook',
      'tiktok',
      'linkedin',
      'snapchat',
      'twitter',
      'youtube',
      'discord',
    ])('redacts the bare social-platform name "%s"', (name) => {
      const result = service.inspect(locked, `Find us on ${name}`);
      expect(result.safe).toBe(false);
      expect(result.violations[0].patternType).toBe(ViolationPatternType.SOCIAL_MEDIA);
    });
  });

  describe('policy: ordinary unrelated words stay safe', () => {
    it('keeps ambiguous everyday words untouched', () => {
      const text =
        'In my opinion that signal was fine, and I checked the fb page for x.';
      const result = service.inspect(locked, text);
      expect(result.safe).toBe(true);
      expect(result.body).toBe(text);
      expect(result.violations).toEqual([]);
    });

    it('still flags a social-platform name embedded in a sentence', () => {
      const result = service.inspect(locked, 'That youtube video you shared last week');
      expect(result.safe).toBe(false);
    });
  });

  describe('multiple violations', () => {
    it('detects and redacts several distinct violations in one message', () => {
      const result = service.inspect(locked, 'Call me at 0912345678 or email me@test.com');
      expect(result.safe).toBe(false);
      expect(result.body).toBe(
        `Call me at ${REDACTION_PLACEHOLDER} or email ${REDACTION_PLACEHOLDER}`,
      );
      expect(result.violations).toEqual([
        { patternType: ViolationPatternType.PHONE_NUMBER, matchedText: '0912345678' },
        { patternType: ViolationPatternType.EMAIL, matchedText: 'me@test.com' },
      ]);
    });
  });

  describe('unlock behavior', () => {
    it('skips protection entirely for an unlocked thread', () => {
      const unlocked = { unlockedAt: new Date() };
      const result = service.inspect(unlocked, 'Call 0912345678 or email me@test.com');
      expect(result.safe).toBe(true);
      expect(result.body).toBe('Call 0912345678 or email me@test.com');
      expect(result.violations).toEqual([]);
    });

    it('treats a missing unlockedAt (undefined) as still locked', () => {
      const result = service.inspect({ unlockedAt: undefined }, 'Call 0912345678');
      expect(result.safe).toBe(false);
      expect(result.violations[0].patternType).toBe(ViolationPatternType.PHONE_NUMBER);
    });
  });

  it('returns safe for normal messages', () => {
    const result = service.inspect(locked, 'Is this still available for pickup tomorrow?');
    expect(result.safe).toBe(true);
    expect(result.body).toBe('Is this still available for pickup tomorrow?');
    expect(result.violations).toEqual([]);
  });
});