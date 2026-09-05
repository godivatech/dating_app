import {
  PrismaClient,
  Gender,
  PreferredGenderMode,
  RelationshipIntent,
  ProfileStatus,
  ProfileVisibility,
  PhotoStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_TAMIL_PROFILES = [
  {
    phone: '+919840112345',
    displayName: 'Priya Sundaram',
    dob: '2000-05-14', // 24
    gender: Gender.WOMAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Architect & Carnatic music enthusiast. Weekends are for Besant Nagar beach walks, filter coffee, and exploring art galleries ✨',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 23,
    maxAge: 32,
    interests: ['outdoors-beach', 'music-bollywood', 'food-coffee', 'arts-photography', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840223456',
    displayName: 'Kavitha Rajan',
    dob: '2001-08-20', // 23
    gender: Gender.WOMAN,
    city: 'Coimbatore',
    region: 'Tamil Nadu',
    bio: 'Software Engineer @ tech startup. Coffee addict ☕, loves trekking in Western Ghats, badminton, and casual weekend road trips.',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 22,
    maxAge: 30,
    interests: ['food-coffee', 'outdoors-hiking', 'fitness-gym', 'lifestyle-gaming', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840334567',
    displayName: 'Ananya Krishnan',
    dob: '1998-11-10', // 26
    gender: Gender.WOMAN,
    city: 'Madurai',
    region: 'Tamil Nadu',
    bio: 'Doctor by profession, foodie by passion 🍜. Always up for midnight street food, good books, and live acoustic music sessions.',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 25,
    maxAge: 34,
    interests: ['food-street', 'food-cooking', 'arts-reading', 'music-live', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840445678',
    displayName: 'Deepika Murugan',
    dob: '1999-03-25', // 25
    gender: Gender.WOMAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Visual artist & interior designer. Passionate about retro cinema, contemporary art, and golden hour cycling along ECR.',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 24,
    maxAge: 33,
    interests: ['arts-cinema', 'arts-photography', 'outdoors-beach', 'food-coffee', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840556789',
    displayName: 'Sneha Venkatesh',
    dob: '2002-07-18', // 22
    gender: Gender.WOMAN,
    city: 'Tiruchirappalli',
    region: 'Tamil Nadu',
    bio: 'UI/UX Designer & dog mom 🐶. Love weekend baking, aesthetic cafes, and exploring historical architecture.',
    intent: RelationshipIntent.OPEN_TO_EXPLORE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 22,
    maxAge: 29,
    interests: ['food-coffee', 'food-cooking', 'arts-photography', 'music-live', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840667890',
    displayName: 'Karthik Raman',
    dob: '1997-02-12', // 27
    gender: Gender.MAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Product Manager in FinTech. Cricket buff 🏏, gym enthusiast, and weekend surfer at Covelong Point.',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 22,
    maxAge: 29,
    interests: ['sports-cricket', 'fitness-gym', 'outdoors-beach', 'lifestyle-travel', 'food-coffee'],
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840778901',
    displayName: 'Arun Vijay',
    dob: '1998-09-05', // 26
    gender: Gender.MAN,
    city: 'Coimbatore',
    region: 'Tamil Nadu',
    bio: 'Automobile engineer & motorcycle rider. Love spontaneous Western Ghats road trips, photography, and good filter kaapi.',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 22,
    maxAge: 30,
    interests: ['outdoors-hiking', 'lifestyle-travel', 'arts-photography', 'food-coffee', 'music-live'],
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840889012',
    displayName: 'Siddharth Narayanan',
    dob: '1996-06-15', // 28
    gender: Gender.MAN,
    city: 'Madurai',
    region: 'Tamil Nadu',
    bio: 'Independent filmmaker & photographer. Cinema lover, passionate about Tamil culture, and discovering hidden authentic food spots.',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 23,
    maxAge: 31,
    interests: ['arts-cinema', 'arts-reading', 'arts-photography', 'food-street', 'music-live'],
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
    ],
  },
];

async function seed() {
  console.log('🌱 Starting seed for Tamil Nadu sample dating profiles...');

  // Ensure interests exist
  const sampleInterests = [
    { id: 'outdoors-beach', name: 'Beach Trips', category: 'Outdoors' },
    { id: 'outdoors-hiking', name: 'Hiking', category: 'Outdoors' },
    { id: 'music-live', name: 'Live Music', category: 'Music' },
    { id: 'music-bollywood', name: 'Bollywood & Classical', category: 'Music' },
    { id: 'music-indie', name: 'Indie & Alternative', category: 'Music' },
    { id: 'food-coffee', name: 'Coffee & Cafes', category: 'Food & Drink' },
    { id: 'food-cooking', name: 'Cooking', category: 'Food & Drink' },
    { id: 'food-street', name: 'Street Food', category: 'Food & Drink' },
    { id: 'fitness-gym', name: 'Gym & Fitness', category: 'Fitness & Sports' },
    { id: 'sports-cricket', name: 'Cricket', category: 'Fitness & Sports' },
    { id: 'arts-photography', name: 'Photography', category: 'Arts & Culture' },
    { id: 'arts-cinema', name: 'Movies & Cinema', category: 'Arts & Culture' },
    { id: 'arts-reading', name: 'Reading & Books', category: 'Arts & Culture' },
    { id: 'lifestyle-travel', name: 'Travel & Trips', category: 'Lifestyle' },
    { id: 'lifestyle-gaming', name: 'Gaming', category: 'Lifestyle' },
    { id: 'lifestyle-pets', name: 'Dogs & Pets', category: 'Lifestyle' },
  ];

  for (const interest of sampleInterests) {
    await prisma.interest.upsert({
      where: { id: interest.id },
      update: { name: interest.name, category: interest.category },
      create: { id: interest.id, name: interest.name, category: interest.category },
    });
  }
  console.log('✅ Interests synchronized.');

  for (const profileData of SAMPLE_TAMIL_PROFILES) {
    // 1. Create or get user
    const user = await prisma.user.upsert({
      where: { phoneNumber: profileData.phone },
      update: {
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
        phoneVerifiedAt: new Date(),
      },
      create: {
        phoneNumber: profileData.phone,
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
        phoneVerifiedAt: new Date(),
      },
    });

    // 2. Create or update Dating Profile
    const profile = await prisma.datingProfile.upsert({
      where: { userId: user.id },
      update: {
        displayName: profileData.displayName,
        dateOfBirth: new Date(profileData.dob),
        gender: profileData.gender,
        bio: profileData.bio,
        locationCity: profileData.city,
        locationRegion: profileData.region,
        locationCountry: 'IN',
        visibility: ProfileVisibility.VISIBLE,
        status: ProfileStatus.READY,
      },
      create: {
        userId: user.id,
        displayName: profileData.displayName,
        dateOfBirth: new Date(profileData.dob),
        gender: profileData.gender,
        bio: profileData.bio,
        locationCity: profileData.city,
        locationRegion: profileData.region,
        locationCountry: 'IN',
        visibility: ProfileVisibility.VISIBLE,
        status: ProfileStatus.READY,
      },
    });

    // 3. Dating Preferences
    await prisma.datingPreferences.upsert({
      where: { profileId: profile.id },
      update: {
        preferredGenderMode: profileData.preferredGenderMode,
        preferredGenders: profileData.preferredGenders,
        minAge: profileData.minAge,
        maxAge: profileData.maxAge,
        relationshipIntent: profileData.intent,
      },
      create: {
        profileId: profile.id,
        preferredGenderMode: profileData.preferredGenderMode,
        preferredGenders: profileData.preferredGenders,
        minAge: profileData.minAge,
        maxAge: profileData.maxAge,
        relationshipIntent: profileData.intent,
      },
    });

    // 4. Interests Link
    await prisma.profileInterest.deleteMany({
      where: { profileId: profile.id },
    });

    for (const interestId of profileData.interests) {
      await prisma.profileInterest.create({
        data: {
          profileId: profile.id,
          interestId,
        },
      });
    }

    // 5. Photos
    await prisma.profilePhoto.deleteMany({
      where: { profileId: profile.id },
    });

    for (let i = 0; i < profileData.photos.length; i++) {
      const url = profileData.photos[i];
      await prisma.profilePhoto.create({
        data: {
          profileId: profile.id,
          objectKey: url,
          thumbnailKey: url,
          mediumKey: url,
          largeKey: url,
          position: i,
          status: PhotoStatus.APPROVED,
        },
      });
    }

    console.log(`✅ Seeded profile: ${profileData.displayName} (${profileData.city}, ${profileData.gender})`);
  }

  console.log('🎉 All sample Tamil profiles successfully seeded!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
