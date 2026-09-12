import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PROFANITY_EN } from '../data/profanity-en';
import { PROFANITY_TA } from '../data/profanity-ta';
import { PROFANITY_HI } from '../data/profanity-hi';
import { normalizeText } from '../utils/text-normalizer.util';
import { TrieMatcher } from '../utils/trie-matcher.util';
import { detectContactAndScams, ContactOrScamViolation } from '../utils/contact-and-scam.util';
import {
  ContentViolationCategory,
  ContentViolationDetail,
  ContentFilterResultDto,
} from '../../../../shared/src/types';

export interface ScanOptions {
  context?: 'CHAT' | 'DIRECT_NOTE' | 'PROFILE';
  allowContactInfo?: boolean;
}

@Injectable()
export class ContentFilterService implements OnModuleInit {
  private readonly logger = new Logger(ContentFilterService.name);
  private readonly trieMatcher = new TrieMatcher();

  onModuleInit() {
    this.logger.log('Initializing multi-language safety lexicons (EN, TA, HI)...');
    this.trieMatcher.loadWords(PROFANITY_EN, 'PROFANITY');
    this.trieMatcher.loadWords(PROFANITY_TA, 'PROFANITY');
    this.trieMatcher.loadWords(PROFANITY_HI, 'PROFANITY');
    this.logger.log('Multi-language safety lexicons loaded successfully into Trie.');
  }

  /**
   * Scans input text for abusive words, harassment phrases, contact details, and scam patterns.
   */
  scanText(text: string, options?: ScanOptions): ContentFilterResultDto {
    if (!text || text.trim().length === 0) {
      return { isClean: true, violations: [] };
    }

    const violations: ContentViolationDetail[] = [];
    const normalized = normalizeText(text);

    // 1. Trie Profanity & Abusive Language Match (Checks normalized tokens and collapsed variations)
    const profanityMatches = [
      ...this.trieMatcher.findMatches(normalized.normalized, normalized.words),
      ...this.trieMatcher.findMatches(normalized.collapsed, normalized.words),
    ];

    const seenMatchedWords = new Set<string>();
    for (const match of profanityMatches) {
      if (!seenMatchedWords.has(match.matched)) {
        seenMatchedWords.add(match.matched);
        violations.push({
          category: ContentViolationCategory.PROFANITY,
          matched: match.matched,
          reason: `Contains abusive or sexually explicit content violating community standards: "${match.matched}".`,
        });
      }
    }

    // 2. Contact Information and Scam Detection (unless explicitly bypassed)
    if (!options?.allowContactInfo) {
      const contactViolations = detectContactAndScams(text);
      for (const cv of contactViolations) {
        violations.push({
          category:
            cv.category === 'SCAM'
              ? ContentViolationCategory.SCAM
              : ContentViolationCategory.CONTACT_INFO,
          matched: cv.matched,
          reason: cv.reason,
        });
      }
    }

    return {
      isClean: violations.length === 0,
      violations,
    };
  }

  /**
   * Validates input text. Throws a user-facing BadRequestException if violations are detected.
   */
  validateOrThrow(
    text: string,
    context: 'CHAT' | 'DIRECT_NOTE' | 'PROFILE' = 'CHAT',
  ): void {
    const result = this.scanText(text, { context });
    if (!result.isClean) {
      const primaryViolation = result.violations[0];
      let userMessage = 'Your submission contains content that violates our community safety standards.';

      if (primaryViolation.category === ContentViolationCategory.PROFANITY) {
        userMessage =
          'Your message contains abusive, vulgar, or inappropriate language that is prohibited on Truelove.';
      } else if (primaryViolation.category === ContentViolationCategory.CONTACT_INFO) {
        userMessage =
          'Sharing phone numbers or off-platform contact handles is restricted to protect member privacy and prevent spam.';
      } else if (primaryViolation.category === ContentViolationCategory.SCAM) {
        userMessage =
          'Sharing payment IDs, links, or money solicitation patterns is strictly prohibited.';
      }

      this.logger.warn(
        `[SAFETY_CONTENT_BLOCKED] Context: ${context} | Category: ${primaryViolation.category} | Matched: ${primaryViolation.matched}`,
      );

      throw new BadRequestException(userMessage);
    }
  }
}
