/**
 * High-performance In-Memory Trie (Prefix Tree) for Multi-Language Profanity & Slur Detection.
 * Supports O(N) linear-time search with boundary-safe matching to prevent the "Scunthorpe problem"
 * (e.g., prevents "class" or "classic" from falsely triggering on "ass").
 */

interface TrieNode {
  children: Map<string, TrieNode>;
  isEndOfWord: boolean;
  word?: string;
  category: string;
}

export interface TrieMatchResult {
  matched: string;
  category: string;
  index?: number;
}

export class TrieMatcher {
  private root: TrieNode = {
    children: new Map(),
    isEndOfWord: false,
    category: '',
  };

  private phraseList: { phrase: string; category: string }[] = [];

  constructor() {}

  /**
   * Inserts a bad word or phrase into the Trie.
   */
  insert(rawWord: string, category: string = 'PROFANITY'): void {
    const word = rawWord.trim().toLowerCase();
    if (!word) return;

    // If multi-word phrase (contains spaces), track for phrase matching
    if (word.includes(' ')) {
      this.phraseList.push({ phrase: word, category });
    }

    let current = this.root;
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      if (!current.children.has(char)) {
        current.children.set(char, {
          children: new Map(),
          isEndOfWord: false,
          category: '',
        });
      }
      current = current.children.get(char)!;
    }
    current.isEndOfWord = true;
    current.word = word;
    current.category = category;
  }

  /**
   * Bulk loads a wordlist into the Trie.
   */
  loadWords(words: string[], category: string = 'PROFANITY'): void {
    for (const w of words) {
      this.insert(w, category);
    }
  }

  /**
   * Searches for exact word matches in tokenized word list with boundary safety,
   * plus substring scans for multi-word phrases.
   */
  findMatches(text: string, tokens: string[]): TrieMatchResult[] {
    const matches: TrieMatchResult[] = [];
    const seenWords = new Set<string>();

    // 1. Check exact word tokens against Trie (prevents "class" matching "ass")
    for (const token of tokens) {
      const lower = token.toLowerCase();
      let current = this.root;
      let matched = true;

      for (let i = 0; i < lower.length; i++) {
        const char = lower[i];
        if (!current.children.has(char)) {
          matched = false;
          break;
        }
        current = current.children.get(char)!;
      }

      if (matched && current.isEndOfWord && current.word) {
        if (!seenWords.has(current.word)) {
          seenWords.add(current.word);
          matches.push({
            matched: current.word,
            category: current.category,
          });
        }
      }
    }

    // 2. Check multi-word phrases against the full text (e.g. "call girl", "send nudes", "thevidiya paiya")
    const lowerText = text.toLowerCase();
    for (const { phrase, category } of this.phraseList) {
      if (lowerText.includes(phrase)) {
        if (!seenWords.has(phrase)) {
          seenWords.add(phrase);
          matches.push({
            matched: phrase,
            category,
          });
        }
      }
    }

    return matches;
  }
}
