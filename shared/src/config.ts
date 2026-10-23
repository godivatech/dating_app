/**
 * Single Source of Truth for App Branding, Identity, and Legal Information.
 * Edit values here to automatically propagate across Mobile, Backend, and Legal portals.
 */
export const APP_CONFIG = {
  appName: 'Genzdate',
  brandNameUpper: 'GENZDATE',
  brandNameLower: 'genzdate',
  brandFirst: 'GENZ',
  brandSecond: 'DATE',
  legalName: 'Genzdate Dating',
  companyName: 'Godiva Tech',
  tagline: 'Connect Authentically',
  androidPackage: 'com.godivatech.datingapp',
  iosBundleId: 'com.godivatech.dating-app',
  contactEmail: 'infogodivatech@gmail.com',
  supportEmail: 'infogodivatech@gmail.com',
  grievanceEmail: 'infogodivatech@gmail.com',
  urls: {
    base: 'https://dating-app-idvk.onrender.com',
    privacy: 'https://dating-app-idvk.onrender.com/privacy',
    terms: 'https://dating-app-idvk.onrender.com/terms',
    deleteAccount: 'https://dating-app-idvk.onrender.com/delete-account',
  },
  tiers: {
    plus: 'Genzdate Plus',
    gold: 'Genzdate Gold',
    goldVip: 'Genzdate Gold VIP',
    coins: 'Genzdate Coins',
    premium: 'Genzdate Premium',
    coinWallet: 'Genzdate Coin Wallet',
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
