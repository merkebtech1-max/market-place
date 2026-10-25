import { ViolationPatternType } from '../../generated/prisma/enums.js';

/**
 * Contact-information detection definitions (patterns) used by ContactInfoService.
 *
 * The regexes are deliberately loose: they capture candidate spans, and phone
 * candidates are then validated against Ethiopian number shapes via
 * `normalizePhoneCandidate`. This catches separator/gap variations that a
 * "perfectly formatted" regex alone would miss (091 234 5678, 091-234-5678,
 * +251 91 234 5678, +251 (0) 912345678, ...).
 *
 * DETECTION POLICY (V1) — deliberately simple:
 *
 *   1. Explicit contact identifier/link → violation
 *        phone, email, @handle, t.me/telegram.me, wa.me / whatsapp links,
 *        social-platform URLs
 *
 *   2. Explicit external messenger/social-platform reference → violation
 *        bare platform names too ("Do you use Telegram?", "add me on whatsapp",
 *        "is there an instagram?"). Threads start locked, so an off-platform
 *        reference is almost always an attempt to move the negotiation outside
 *        Merkeb Market. This is an intentional and strict policy.
 *
 *   3. Ordinary unrelated words → safe
 *        ambiguous short forms that are also everyday words are deliberately
 *        NOT detected: "x" (for X/twitter), "fb", "imo" (in-my-opinion),
 *        "signal" (a common noun). Redacting those would damage normal speech.
 */

/** Deterministic replacement inserted where prohibited contact info was found. */
export const REDACTION_PLACEHOLDER = '[contact information removed]';

/** Loose candidate: any run of 8+ digits with optional separator chars
 * (space, dot, dash, parens) between them, optionally prefixed by + or (.
 * Post-validated by normalizePhoneCandidate so false positives (years, pins)
 * are dropped. */
const PHONE_CANDIDATE =
  /(?<![+\d])(?:[+(]\s*)?[+]?\d(?:[\s().-]*\d){7,12}\)?(?!\d)/g;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** @username telegram/social handle. Lookbehind blocks "@..." inside emails. */
const TELEGRAM_HANDLE =
  /(?<![\w@.'+%-])(@[A-Za-z0-9_]{3,32})(?!\w)/g;

const TELEGRAM_LINK =
  /(?:https?:\/\/)?(?:t\.me|telegram\.me|telegram\.dog|telegram\.org)\/[A-Za-z0-9_+]{3,}/gi;

const WHATSAPP_LINK =
  /(?:https?:\/\/)?(?:wa\.me\/\d+|api\.whatsapp\.com\/send\?phone=\d+|chat\.whatsapp\.com\/[A-Za-z0-9]+)/gi;

const SOCIAL_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|tiktok\.com|vm\.tiktok\.com|linkedin\.com|snapchat\.com|x\.com|twitter\.com|youtube\.com)(?:\/[^\s]*)?/gi;

/** Bare "Telegram" itself. Every locked thread starts here, so this is a
 * deliberate, policy-driven redaction ("Do you use Telegram?" → violation). */
const TELEGRAM_NAME = /\btelegram\b/gi;

/** Bare names of other off-platform messengers. "imo"/"signal" excluded on
 * purpose: they collide with ordinary English (see policy point 3). */
const MESSENGER_NAME = /\b(?:whatsapp|viber|skype|wechat)\b/gi;

/** Bare social-platform names, mirroring SOCIAL_LINK. "x" and "fb" excluded
 * as too ambiguous (see policy point 3). */
const SOCIAL_MEDIA_NAME = /\b(?:instagram|insta|facebook|tiktok|linkedin|snapchat|twitter|youtube|discord)\b/gi;

export interface ContactPattern {
  type: ViolationPatternType;
  regex: RegExp;
}

export const CONTACT_PATTERNS: ContactPattern[] = [
  { type: ViolationPatternType.EMAIL, regex: EMAIL },
  { type: ViolationPatternType.PHONE_NUMBER, regex: PHONE_CANDIDATE },
  { type: ViolationPatternType.TELEGRAM, regex: TELEGRAM_HANDLE },
  { type: ViolationPatternType.TELEGRAM, regex: TELEGRAM_LINK },
  { type: ViolationPatternType.EXTERNAL_CONTACT, regex: WHATSAPP_LINK },
  { type: ViolationPatternType.SOCIAL_MEDIA, regex: SOCIAL_LINK },
  { type: ViolationPatternType.TELEGRAM, regex: TELEGRAM_NAME },
  { type: ViolationPatternType.EXTERNAL_CONTACT, regex: MESSENGER_NAME },
  { type: ViolationPatternType.SOCIAL_MEDIA, regex: SOCIAL_MEDIA_NAME },
];

/**
 * Validates a phone candidate by collapsing separators and checking the
 * resulting digit run matches an Ethiopian number shape:
 *   - local:  0 + 9 digits        (09xxxxxxxx, landlines like 011xxxxxxx)
 *   - intl:   251 [+ optional (0)] + 9 digits   (with or without the leading +)
 * Returns the normalized digits when valid, otherwise null.
 */
export function normalizePhoneCandidate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits) || /^2510?\d{9}$/.test(digits)) {
    return digits;
  }
  return null;
}