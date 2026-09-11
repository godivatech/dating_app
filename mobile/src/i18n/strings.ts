/**
 * Localization strings foundation (English active, Tamil supported)
 */

export type Locale = 'en' | 'ta';

export const strings = {
  en: {
    // App & Common
    appName: 'Truelove',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    error: 'Error',
    retry: 'Retry',
    success: 'Success',
    back: 'Back',

    // Dashboard
    dashboardTitle: 'Discover Your Match',
    completeProfileBanner: 'Complete your profile to unlock Discovery!',
    completionStatus: 'Profile Completion: {percent}%',
    statusReady: 'Ready for Discovery',
    statusInProgress: 'In Progress',
    statusHidden: 'Hidden from Discovery',
    quickActions: 'Quick Navigation',
    navDiscovery: 'Discovery',
    navDiscoverySubtitle: 'Swipe & find potential matches',
    navMatches: 'Matches',
    navMatchesSubtitle: 'People who liked you back',
    navChat: 'Messages',
    navChatSubtitle: 'Conversations with matches',
    navNotifications: 'Notifications',
    navNotificationsSubtitle: 'Matches, messages & updates',
    navSafety: 'Safety Center',
    navSafetySubtitle: 'Blocklist & report status',
    navEditProfile: 'Edit Profile',
    navEditProfileSubtitle: 'Update bio, details & preferences',
    navPhotos: 'Photos',
    navPhotosSubtitle: 'Manage your profile pictures',

    // Discovery & Matching
    like: 'Like',
    pass: 'Pass',
    itsAMatch: "It's a Match! 🎉",
    matchedDescription: 'You and {name} liked each other.',
    startChatting: 'Start Conversation',
    keepSwiping: 'Keep Browsing',
    viewProfile: 'View Full Profile',
    noMoreProfiles: 'No more profiles around you.',
    checkBackLater: 'Check back soon or adjust your preferences to see more people.',

    // Full Profile
    aboutMe: 'About Me',
    basics: 'The Basics',
    interests: 'Interests',
    age: '{age} years old',
    verifiedProfile: 'Verified Profile',
    blockUser: 'Block User',
    reportUser: 'Report Profile',
    safetyMenu: 'Safety Options',

    // Notifications
    notificationsTitle: 'Notification Center',
    allNotifications: 'All',
    unreadNotifications: 'Unread',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications yet',
    noNotificationsSubtitle: 'When you get matches or messages, they will appear here.',
    newMatchNotif: 'New Match',
    newMessageNotif: 'New Message',
    missedCallNotif: 'Missed Call',
    safetyUpdateNotif: 'Safety Update',
    systemNotif: 'System Update',

    // Profile Edit
    editProfileTitle: 'Edit Profile',
    displayNameLabel: 'Display Name',
    dobLabel: 'Date of Birth (YYYY-MM-DD)',
    bioLabel: 'About You (Bio)',
    heightLabel: 'Height (cm)',
    smokingLabel: 'Smoking',
    drinkingLabel: 'Drinking',
    educationLabel: 'Education',
    occupationLabel: 'Occupation',
    starSignLabel: 'Star Sign',
    religionLabel: 'Religion',
    languagesLabel: 'Languages Spoken (comma separated)',
    profileUpdatedSuccess: 'Profile successfully updated!',
    underAgeError: 'You must be at least 18 years old to use this app.',
    invalidDobFormat: 'Please enter a valid date of birth (YYYY-MM-DD).',
    // Monetization & Entitlements
    navPremium: 'Truelove Premium',
    navPremiumSubtitle: 'Subscriptions, perks & capabilities',
    upgradeToPlus: 'Upgrade to Truelove Plus',
    upgradeToGold: 'Upgrade to Truelove Gold',
    unlimitedLikes: 'Unlimited Likes',
    unlimitedLikesDesc: 'Swipe and like as many profiles as you want every day',
    seeWhoLikedYou: 'See Who Liked You',
    seeWhoLikedYouDesc: 'Unmask everyone who swiped right on your profile',
    rewindPass: 'Rewind Pass',
    rewindPassDesc: 'Undo accidental passes in the discovery feed',
    profileBoost: 'Profile Boost',
    profileBoostDesc: 'Get up to 10x more visibility in your city',
    dailyLikesLeft: '{count} likes left today',
    unlimitedLikesActive: 'Unlimited likes active',
    unlockWithGold: 'Unlock with Truelove Gold',
    whoLikedYouTitle: 'Who Liked You',
    whoLikedYouSubtitle: '{count} people liked your profile',
    restorePurchases: 'Restore Purchases',
    purchaseSuccess: 'Subscription activated successfully!',
    restoreSuccess: 'Purchases restored successfully!',
    cancelSubscription: 'Cancel Subscription',
    cancelSubscriptionDesc: 'Keep your perks until the end of your billing cycle',
    subscribedUntil: 'Active until {date}',
    freeTier: 'Free Member',
    plusTier: 'Truelove Plus',
    goldTier: 'Truelove Gold',
    rewindSuccess: 'Pass undone!',
    outOfLikesTitle: 'Out of Daily Likes!',
    outOfLikesDesc: 'Free users get 25 likes every 24 hours. Upgrade to Truelove Plus for unlimited daily likes.',
    rewindLockTitle: 'Rewind is a Premium Perk',
    rewindLockDesc: 'Accidentally swiped left? Truelove Plus lets you rewind your last pass instantly.',
  },
  ta: {
    // App & Common
    appName: 'ட்ரூலவ்',
    loading: 'ஏற்றுகிறது...',
    save: 'சேமி',
    cancel: 'ரத்துசெய்',
    close: 'மூடு',
    error: 'பிழை',
    retry: 'மீண்டும் முயற்சி',
    success: 'வெற்றி',
    back: 'பின்செல்',

    // Dashboard
    dashboardTitle: 'உங்கள் துணையைத் தேடுங்கள்',
    completeProfileBanner: 'சுயவிவரத்தை முழுமையாக்கி பரிந்துரைகளைப் பெறுங்கள்!',
    completionStatus: 'சுயவிவர நிறைவு: {percent}%',
    statusReady: 'பரிந்துரைக்குத் தயார்',
    statusInProgress: 'முன்னேற்றத்தில் உள்ளது',
    statusHidden: 'மறைக்கப்பட்டுள்ளது',
    quickActions: 'விரைவு வழிசெலுத்தல்',
    navDiscovery: 'பரிந்துரைகள்',
    navDiscoverySubtitle: 'துணைகளைக் கண்டறியவும்',
    navMatches: 'பொருத்தங்கள்',
    navMatchesSubtitle: 'இருபுறமும் விரும்பியவர்கள்',
    navChat: 'செய்திகள்',
    navChatSubtitle: 'உரையாடல்கள்',
    navNotifications: 'அறிவிப்புகள்',
    navNotificationsSubtitle: 'செய்திகள் & நிகழ்வுகள்',
    navSafety: 'பாதுகாப்பு மையம்',
    navSafetySubtitle: 'தடைசெய்தல் & புகார்',
    navEditProfile: 'சுயவிவர மாற்றம்',
    navEditProfileSubtitle: 'விவரங்களைப் புதுப்பிக்கவும்',
    navPhotos: 'புகைப்படங்கள்',
    navPhotosSubtitle: 'படங்களை நிர்வகிக்கவும்',

    // Discovery & Matching
    like: 'விருப்பம்',
    pass: 'தவிர்',
    itsAMatch: 'பொருத்தம் உறுதியானது! 🎉',
    matchedDescription: 'நீங்களும் {name} அவர்களும் ஒருவரையொருவர் விரும்பியுள்ளீர்கள்.',
    startChatting: 'உரையாடலைத் தொடங்கு',
    keepSwiping: 'தொடர்ந்து பார்க்கவும்',
    viewProfile: 'முழு விவரம்',
    noMoreProfiles: 'மேலும் சுயவிவரங்கள் இல்லை.',
    checkBackLater: 'சிறிது நேரம் கழித்து மீண்டும் பார்க்கவும்.',

    // Full Profile
    aboutMe: 'என்னைப்பற்றி',
    basics: 'அடிப்படை விவரங்கள்',
    interests: 'ஆர்வங்கள்',
    age: '{age} வயது',
    verifiedProfile: 'சரிபார்க்கப்பட்ட சுயவிவரம்',
    blockUser: 'தடைசெய்',
    reportUser: 'புகாரளி',
    safetyMenu: 'பாதுகாப்பு விருப்பங்கள்',

    // Notifications
    notificationsTitle: 'அறிவிப்பு மையம்',
    allNotifications: 'அனைத்தும்',
    unreadNotifications: 'படிக்காதவை',
    markAllRead: 'அனைத்தையும் படித்ததாகக் குறிக்கவும்',
    noNotifications: 'அறிவிப்புகள் எதுவும் இல்லை',
    noNotificationsSubtitle: 'புதிய பொருத்தங்கள் வரும்போது இங்கு காட்டப்படும்.',
    newMatchNotif: 'புதிய பொருத்தம்',
    newMessageNotif: 'புதிய செய்தி',
    missedCallNotif: 'தவறிய அழைப்பு',
    safetyUpdateNotif: 'பாதுகாப்பு அறிவிப்பு',
    systemNotif: 'அமைப்பு அறிவிப்பு',

    // Profile Edit
    editProfileTitle: 'சுயவிவரம் திருத்து',
    displayNameLabel: 'பெயர்',
    dobLabel: 'பிறந்த தேதி (YYYY-MM-DD)',
    bioLabel: 'உங்களைப் பற்றி',
    heightLabel: 'உயரம் (செ.மீ)',
    smokingLabel: 'புகைபிடிக்கும் பழக்கம்',
    drinkingLabel: 'மது அருந்தும் பழக்கம்',
    educationLabel: 'கல்வி',
    occupationLabel: 'தொழில்',
    starSignLabel: 'ராசி',
    religionLabel: 'மதம்',
    languagesLabel: 'மொழிகள்',
    profileUpdatedSuccess: 'சுயவிவரம் வெற்றிகரமாக புதுப்பிக்கப்பட்டது!',
    underAgeError: 'நீங்கள் 18 வயதுக்கு மேற்பட்டவராக இருக்க வேண்டும்.',
    invalidDobFormat: 'தவறான தேதி வடிவம். YYYY-MM-DD பயன்படுத்தவும்.',

    // Monetization & Entitlements
    navPremium: 'ட்ரூலவ் பிரீமியம்',
    navPremiumSubtitle: 'சந்தா & சிறப்பம்சங்கள்',
    upgradeToPlus: 'ட்ரூலவ் பிளஸ் பெறுக',
    upgradeToGold: 'ட்ரூலவ் கோல்ட் பெறுக',
    unlimitedLikes: 'வரம்பற்ற விருப்பங்கள்',
    unlimitedLikesDesc: 'தினமும் எத்தனை சுயவிவரங்களை வேண்டுமானாலும் விரும்பலாம்',
    seeWhoLikedYou: 'உங்களை விரும்பியவர்களைப் பாருங்கள்',
    seeWhoLikedYouDesc: 'உங்களை விரும்பிய அனைவரின் படங்களையும் முழுமையாகக் காண்க',
    rewindPass: 'முந்தைய சுயவிவரத்தை மீட்டெடு',
    rewindPassDesc: 'தவறுதலாகத் தவிர்த்த சுயவிவரத்தை மீண்டும் பாருங்கள்',
    profileBoost: 'சுயவிவர பூஸ்ட்',
    profileBoostDesc: 'உங்கள் ஊரில் 10 மடங்கு அதிக பார்வை பெறுங்கள்',
    dailyLikesLeft: 'இன்று மீதமுள்ள விருப்பங்கள்: {count}',
    unlimitedLikesActive: 'வரம்பற்ற விருப்பங்கள் பயன்பாட்டில் உள்ளது',
    unlockWithGold: 'ட்ரூலவ் கோல்ட் மூலம் திறக்கவும்',
    whoLikedYouTitle: 'உங்களை விரும்பியவர்கள்',
    whoLikedYouSubtitle: '{count} நபர்கள் உங்களை விரும்பியுள்ளனர்',
    restorePurchases: 'வாங்கியதை மீட்டெடு',
    purchaseSuccess: 'சந்தா வெற்றிகரமாக செயல்படுத்தப்பட்டது!',
    restoreSuccess: 'வாங்கியவை மீட்டெடுக்கப்பட்டன!',
    cancelSubscription: 'சந்தாவை ரத்துசெய்',
    cancelSubscriptionDesc: 'காலாவதி ஆகும் வரை உங்கள் பலன்களைத் தொடரலாம்',
    subscribedUntil: '{date} வரை பயன்பாட்டில் உள்ளது',
    freeTier: 'இலவச பயனர்',
    plusTier: 'ட்ரூலவ் பிளஸ்',
    goldTier: 'ட்ரூலவ் கோல்ட்',
    rewindSuccess: 'சுயவிவரம் மீட்டெடுக்கப்பட்டது!',
    outOfLikesTitle: 'இன்றைய விருப்பங்கள் முடிந்தது!',
    outOfLikesDesc: 'இலவச பயனர்களுக்கு ஒரு நாளைக்கு 25 விருப்பங்கள். வரம்பற்ற விருப்பங்களுக்கு ட்ரூலவ் பிளஸ் பெறுக.',
    rewindLockTitle: 'மீட்டெடுத்தல் ஒரு பிரீமியம் வசதி',
    rewindLockDesc: 'தவறுதலாகத் தவிர்த்துவிட்டீர்களா? ட்ரூலவ் பிளஸ் மூலம் உடனே மீட்டெடுக்கலாம்.',
  },
};

let currentLocale: Locale = 'en';

export const setLocale = (locale: Locale) => {
  currentLocale = locale;
};

export const getLocale = (): Locale => currentLocale;

export type StringKey = keyof typeof strings.en;

export const t = (key: StringKey, params?: Record<string, string | number>): string => {
  const dict = strings[currentLocale] || strings.en;
  let str = dict[key] || strings.en[key] || (key as string);
  if (params) {
    Object.entries(params).forEach(([paramKey, val]) => {
      str = str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
    });
  }
  return str;
};
