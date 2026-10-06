import { ImageSourcePropType } from 'react-native';
import { GiftType } from '../../../shared/src/types';

export const GIFT_ASSETS: Record<GiftType, ImageSourcePropType> = {
  [GiftType.ROSE]: require('../../assets/gifts/rose_3d.png'),
  [GiftType.CHOCOLATE]: require('../../assets/gifts/chocolates_3d.png'),
  [GiftType.TEDDY_BEAR]: require('../../assets/gifts/teddy_3d.png'),
  [GiftType.DIAMOND_RING]: require('../../assets/gifts/diamond_ring_3d.png'),
  [GiftType.ROYAL_CROWN]: require('../../assets/gifts/crown_3d.png'),
};

export const COIN_ASSET: ImageSourcePropType = require('../../assets/gifts/coin_3d.png');

export function getGiftAsset(type: string | GiftType): ImageSourcePropType {
  if (type && type in GIFT_ASSETS) {
    return GIFT_ASSETS[type as GiftType];
  }
  return GIFT_ASSETS[GiftType.ROSE];
}

export interface GiftMetadata {
  giftName: string;
  coins: number;
  tag: string;
}

export const GIFT_INFO: Record<GiftType, GiftMetadata> = {
  [GiftType.ROSE]: { giftName: 'Red Rose', coins: 10, tag: 'Classic Romance' },
  [GiftType.CHOCOLATE]: { giftName: 'Artisan Chocolates', coins: 30, tag: 'Sweet Treat' },
  [GiftType.TEDDY_BEAR]: { giftName: 'Teddy Bear', coins: 50, tag: 'Fluffy Companion' },
  [GiftType.DIAMOND_RING]: { giftName: 'Diamond Ring', coins: 100, tag: 'Pure Luxury' },
  [GiftType.ROYAL_CROWN]: { giftName: 'Royal Crown', coins: 250, tag: 'Royalty VIP' },
};

export interface ParsedGiftData {
  giftType: GiftType;
  giftName: string;
  coins: number;
  tag: string;
}

export function parseGiftMessage(body: string): ParsedGiftData | null {
  if (!body) return null;
  const trimmed = body.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicit tag pattern: [GIFT:ROYAL_CROWN]
  const tagMatch = body.match(/\[GIFT:([A-Z_]+)\]/);
  if (tagMatch) {
    const matchedType = tagMatch[1] as GiftType;
    if (matchedType in GIFT_ASSETS) {
      const info = GIFT_INFO[matchedType] || {
        giftName: 'Special Gift',
        coins: 10,
        tag: 'Virtual Gift',
      };
      return {
        giftType: matchedType,
        ...info,
      };
    }
  }

  // 2. Sent pattern matching: "Sent a ...", "🎁 Sent a ...", etc.
  const isSentPattern =
    lower.startsWith('sent a ') ||
    lower.startsWith('sent an ') ||
    lower.startsWith('🎁 sent a ') ||
    lower.startsWith('🎁 sent an ') ||
    lower.startsWith('🎁') ||
    lower.includes('sent a gift');

  if (!isSentPattern) return null;

  if (lower.includes('crown')) {
    return { giftType: GiftType.ROYAL_CROWN, ...GIFT_INFO[GiftType.ROYAL_CROWN] };
  }
  if (lower.includes('diamond ring') || lower.includes('diamond') || lower.includes('ring')) {
    return { giftType: GiftType.DIAMOND_RING, ...GIFT_INFO[GiftType.DIAMOND_RING] };
  }
  if (lower.includes('teddy')) {
    return { giftType: GiftType.TEDDY_BEAR, ...GIFT_INFO[GiftType.TEDDY_BEAR] };
  }
  if (lower.includes('chocolate')) {
    return { giftType: GiftType.CHOCOLATE, ...GIFT_INFO[GiftType.CHOCOLATE] };
  }
  if (lower.includes('rose')) {
    return { giftType: GiftType.ROSE, ...GIFT_INFO[GiftType.ROSE] };
  }

  return null;
}
