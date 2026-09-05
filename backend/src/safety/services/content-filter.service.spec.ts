import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ContentFilterService } from './content-filter.service';
import { ContentViolationCategory } from '../../../../shared/src/types';

describe('ContentFilterService', () => {
  let service: ContentFilterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentFilterService],
    }).compile();

    service = module.get<ContentFilterService>(ContentFilterService);
    service.onModuleInit();
  });

  describe('Clean text validation', () => {
    it('allows natural friendly compliments and conversation', () => {
      const cleanMessages = [
        'Hey, loved your photos! Do you like hiking?',
        'Vanakkam! Eppadi irukkeenga? Had your coffee?',
        'Namaste! Are you from Chennai or Coimbatore?',
        'Classic movies are my favorite, especially retro cinema.',
        'Taking a dance class this weekend!',
        'My dog is super cute and loves playing fetch.',
      ];

      for (const msg of cleanMessages) {
        const result = service.scanText(msg);
        expect(result.isClean).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(() => service.validateOrThrow(msg, 'CHAT')).not.toThrow();
      }
    });
  });

  describe('English profanity and obfuscation', () => {
    it('detects plain English profanity', () => {
      const result = service.scanText('You are an asshole');
      expect(result.isClean).toBe(false);
      expect(result.violations[0].category).toBe(ContentViolationCategory.PROFANITY);
      expect(() => service.validateOrThrow('You are an asshole')).toThrow(BadRequestException);
    });

    it('detects leetspeak and space evasions (f u c k, b!tch, d!ck, fuuuuck)', () => {
      const evasions = [
        'f u c k you',
        'what a b!tch',
        'you are a d!ck',
        'fuuuuck off',
        'what the sh!t',
      ];

      for (const evasion of evasions) {
        const result = service.scanText(evasion);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.PROFANITY)).toBe(
          true,
        );
      }
    });

    it('detects commercial sex and solicitation phrases', () => {
      const phrases = [
        'Call girl available tonight',
        'Escort service in Chennai',
        'Paid sex available',
        'Send nudes please',
      ];

      for (const p of phrases) {
        const result = service.scanText(p);
        expect(result.isClean).toBe(false);
      }
    });
  });

  describe('Tamil and Tanglish abusive word detection', () => {
    it('detects pure Tamil script abusive words', () => {
      const tamilInputs = [
        'நீ ஒரு ஓத்தா',
        'தேவடியா பயலே',
        'அவன் ஒரு புண்ட மவனே',
      ];

      for (const input of tamilInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.PROFANITY)).toBe(
          true,
        );
      }
    });

    it('detects Tanglish Romanized slang and abusive words', () => {
      const tanglishInputs = [
        'otha dei summa iru',
        'you thevidiya paiya',
        'punda mavane',
        'koothi mavane va da',
        'mayiru pudungadha',
        'sunni sappu',
      ];

      for (const input of tanglishInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.PROFANITY)).toBe(
          true,
        );
      }
    });
  });

  describe('Hindi and Hinglish abusive words', () => {
    it('detects Hindi and Hinglish gaalis', () => {
      const hindiInputs = [
        'tu chutiya hai kya',
        'saale madarchod',
        'bhenchod chup kar',
        'bhosdike yahan se jaa',
        'teri gaand maar dunga',
      ];

      for (const input of hindiInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.PROFANITY)).toBe(
          true,
        );
      }
    });
  });

  describe('Contact info and scam patterns', () => {
    it('blocks Indian phone numbers and spaced variations', () => {
      const phoneInputs = [
        'Call me on +91 9876543210',
        'WhatsApp number 98765 43210',
        'Ping me at 9 8 7 6 5 4 3 2 1 0',
      ];

      for (const input of phoneInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.CONTACT_INFO)).toBe(
          true,
        );
      }
    });

    it('blocks UPI IDs and financial scam solicitations', () => {
      const scamInputs = [
        'Send 500 to my UPI rahul@okhdfcbank',
        'Pay advance payment for booking',
        'Send money on Google Pay me',
      ];

      for (const input of scamInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.SCAM)).toBe(
          true,
        );
      }
    });

    it('blocks off-platform Instagram and Snapchat handles', () => {
      const handleInputs = [
        'Follow me on ig: priya_raj99',
        'Add me on snap: priya.cool',
      ];

      for (const input of handleInputs) {
        const result = service.scanText(input);
        expect(result.isClean).toBe(false);
        expect(result.violations.some((v) => v.category === ContentViolationCategory.CONTACT_INFO)).toBe(
          true,
        );
      }
    });
  });
});
