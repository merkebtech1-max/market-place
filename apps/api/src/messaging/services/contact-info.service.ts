import { Injectable } from '@nestjs/common';
import {
  CONTACT_PATTERNS,
  normalizePhoneCandidate,
  REDACTION_PLACEHOLDER,
} from '../contact-info/contact-info.patterns.js';
import { ViolationPatternType } from '../../generated/prisma/enums.js';

/**
 * Detected per-pattern violation. matchedText is the raw matched snippet and is
 * moderation/audit data only — it must never be returned by a message API nor
 * logged (see the logging rule in MessageCreateService).
 */
export interface ContactInfoViolationDetected {
  patternType: ViolationPatternType;
  matchedText: string;
}

export interface ContactInfoInspection {
  /** true = no prohibited contact info found (store the body verbatim). */
  safe: boolean;
  /** Final visible body: original when safe, else redacted. */
  body: string;
  /** Every distinct detected violation, in message order. */
  violations: ContactInfoViolationDetected[];
}

interface DetectedMatch {
  start: number;
  end: number;
  patternType: ViolationPatternType;
  matchedText: string;
}

interface RedactionSpan {
  start: number;
  end: number;
  matches: DetectedMatch[];
}

/**
 * Decides whether a message may be stored as-is, or must be redacted and
 * flagged. MessageCreateService stays completely unaware of HOW phone numbers
 * or emails are detected — it only asks "is this message safe, and if not,
 * what should I store?".
 *
 * UNLOCK RULE (enforced here, not by the caller): unlocking is the business
 * event that flips the messaging rule. A thread with unlockedAt set means the
 * buyer has paid, so contact information is allowed:
 *   unlockedAt != null (or undefined) → SAFE, skip inspection, store verbatim
 *   unlockedAt == null                 → inspect, redact violations
 * The protection service itself short-circuits on unlockedAt so the caller
 * can never accidentally skip the check — it always hands the thread over.
 */
@Injectable()
export class ContactInfoService {
  inspect(thread: { unlockedAt?: Date | null }, body: string): ContactInfoInspection {
    // unlockedAt present (Date) is the ONLY unlocked state; null/undefined
    // both mean "still locked" and must go through detection.
    if (thread.unlockedAt != null) {
      return { safe: true, body, violations: [] };
    }

    const matches = this.collectMatches(body);
    if (matches.length === 0) {
      return { safe: true, body, violations: [] };
    }

    const spans = coalesce(matches);
    return {
      safe: false,
      body: applyRedactions(body, spans),
      violations: spans.flatMap(toViolations),
    };
  }

  private collectMatches(text: string): DetectedMatch[] {
    const matches: DetectedMatch[] = [];
    for (const { type, regex } of CONTACT_PATTERNS) {
      for (const m of text.matchAll(regex)) {
        const start = m.index ?? 0;
        const matchedText = m[0];
        // Phone candidates are loose; only validated Ethiopian numbers count.
        if (type === ViolationPatternType.PHONE_NUMBER && normalizePhoneCandidate(matchedText) === null) {
          continue;
        }
        matches.push({ start, end: start + matchedText.length, patternType: type, matchedText });
      }
    }
    return matches;
  }
}

/** Merges overlapping matches (e.g. "@user" inside a t.me link or a word in a
 * URL) so overlapping regions are redacted once rather than double-replaced. */
function coalesce(matches: DetectedMatch[]): RedactionSpan[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end);
  const spans: RedactionSpan[] = [];
  for (const match of sorted) {
    const last = spans[spans.length - 1];
    if (last && match.start < last.end) {
      last.end = Math.max(last.end, match.end);
      last.matches.push(match);
    } else {
      spans.push({ start: match.start, end: match.end, matches: [match] });
    }
  }
  return spans;
}

/**
 * Replaces each span in-place with the placeholder, preserving the rest of the
 * message ("Hey, call me at [contact information removed] tomorrow").
 * Ranges are replaced from the end so earlier offsets stay valid.
 */
function applyRedactions(text: string, spans: RedactionSpan[]): string {
  let result = text;
  const sorted = [...spans].sort((a, b) => b.start - a.start);
  for (const span of sorted) {
    result = result.slice(0, span.start) + REDACTION_PLACEHOLDER + result.slice(span.end);
  }
  return result;
}

function toViolations(span: RedactionSpan): ContactInfoViolationDetected[] {
  const seen = new Set<ViolationPatternType>();
  const out: ContactInfoViolationDetected[] = [];
  for (const match of span.matches) {
    if (seen.has(match.patternType)) continue;
    seen.add(match.patternType);
    out.push({ patternType: match.patternType, matchedText: match.matchedText });
  }
  return out;
}