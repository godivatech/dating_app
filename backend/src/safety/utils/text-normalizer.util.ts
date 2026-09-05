/**
 * Leetspeak and symbol substitutions mapping common visual evasions to canonical ASCII characters.
 */
const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '$': 's',
  '5': 's',
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '7': 't',
  '+': 't',
  '8': 'b',
  '(': 'c',
  '[': 'c',
  '{': 'c',
  '<': 'c',
};

/**
 * Common English double-letter words that should retain double letters during deduplication.
 */
const COMMON_DOUBLES = new Set([
  'good',
  'cool',
  'feel',
  'look',
  'meet',
  'kiss',
  'call',
  'tell',
  'free',
  'soon',
  'book',
  'food',
  'need',
  'keep',
  'week',
  'room',
  'peer',
  'deep',
]);

export interface NormalizedVariations {
  raw: string;
  normalized: string;
  collapsed: string;
  words: string[];
}

/**
 * Normalizes text to defeat Unicode homoglyphs, zero-width characters,
 * leetspeak obfuscation, and space-evasion tactics.
 */
export function normalizeText(raw: string): NormalizedVariations {
  if (!raw) {
    return { raw: '', normalized: '', collapsed: '', words: [] };
  }

  // 1. Unicode NFKD normalization (decomposes accents, strips combining marks)
  let text = raw.normalize('NFKD');

  // 2. Remove zero-width spaces, soft hyphens, and non-printable characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u00A0\u00AD]/g, '');

  // 3. Lowercase
  text = text.toLowerCase();

  // 4. Leetspeak substitution
  let leetSubstituted = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    leetSubstituted += LEET_MAP[ch] || ch;
  }

  // 5. Space/separator-collapsed evasion detection
  // Detects spaced out single characters like "f u c k", "s . e . x", "o t h a", "b - i - t - c - h"
  const collapsedSeparators = leetSubstituted.replace(
    /\b([a-zA-Z\u0B80-\u0BFF\u0900-\u097F])(?:\s+|[._\-])(?=([a-zA-Z\u0B80-\u0BFF\u0900-\u097F])(?:\s+|[._\-]|$))/g,
    '$1',
  );

  // 6. Deduplicate repeated characters: "fuuuuck" -> "fuck", "biiiitch" -> "bitch"
  // Reduces 3 or more consecutive identical characters to 1
  const deduplicated = collapsedSeparators.replace(/(.)\1{2,}/g, '$1');

  // Tokenize into clean word tokens
  const cleanTokens = deduplicated
    .replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  return {
    raw,
    normalized: leetSubstituted,
    collapsed: deduplicated,
    words: cleanTokens,
  };
}
