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
