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
    phone: '+919840551111',
    displayName: 'Pooja Shankar',
    dob: '2000-09-12', // 24
    gender: Gender.WOMAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Brand Strategist & Podcaster. Love sunset swims at Kovalam, vinyl records, and deep conversations over filter kaapi ☕',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 23,
    maxAge: 31,
    interests: ['food-coffee', 'music-indie', 'outdoors-beach', 'arts-cinema', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840552222',
    displayName: 'Harini Balaji',
    dob: '1999-12-04', // 25
    gender: Gender.WOMAN,
    city: 'Madurai',
    region: 'Tamil Nadu',
    bio: 'Bharatanatyam dancer & literature teacher. Believer in old-school romance, temple architecture, and soulful Carnatic concerts 🪷',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 24,
    maxAge: 33,
    interests: ['arts-reading', 'music-bollywood', 'food-cooking', 'arts-photography', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840553333',
    displayName: 'Divya Ramesh',
    dob: '2001-04-16', // 23
    gender: Gender.WOMAN,
    city: 'Coimbatore',
    region: 'Tamil Nadu',
    bio: 'Fashion designer & boutique owner. Exploring artisanal textiles, hill station cafe trails, and classical indie music 🌿',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 22,
    maxAge: 29,
    interests: ['arts-photography', 'food-coffee', 'outdoors-hiking', 'lifestyle-travel', 'music-indie'],
    photos: [
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840554444',
    displayName: 'Meera Jayakumar',
    dob: '1998-06-22', // 26
    gender: Gender.WOMAN,
    city: 'Salem',
    region: 'Tamil Nadu',
    bio: 'Financial Analyst & marathon enthusiast. Passionate about fitness, clean eating, and weekend road trips to Yercaud ⛰️',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 25,
    maxAge: 33,
    interests: ['fitness-gym', 'outdoors-hiking', 'food-cooking', 'lifestyle-travel', 'arts-reading'],
    photos: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840555555',
    displayName: 'Swetha Natarajan',
    dob: '2000-01-30', // 24
    gender: Gender.WOMAN,
    city: 'Tirunelveli',
    region: 'Tamil Nadu',
    bio: 'Content Creator & Food Vlogger. Show me the best Halwa and street food in town, and I will be your best friend! 🍲✨',
    intent: RelationshipIntent.OPEN_TO_EXPLORE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 23,
    maxAge: 30,
    interests: ['food-street', 'food-coffee', 'arts-photography', 'lifestyle-travel', 'music-live'],
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840556666',
    displayName: 'Aishwarya Selvam',
    dob: '1997-10-18', // 27
    gender: Gender.WOMAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Corporate Lawyer by day, avid scuba diver by holiday. Seeking intelligent conversations, sarcasm, and mutual growth ⚖️🌊',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 26,
    maxAge: 35,
    interests: ['outdoors-beach', 'arts-reading', 'lifestyle-travel', 'food-coffee', 'fitness-gym'],
    photos: [
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840557777',
    displayName: 'Nithya Chandran',
    dob: '1999-08-08', // 25
    gender: Gender.WOMAN,
    city: 'Tiruchirappalli',
    region: 'Tamil Nadu',
    bio: 'Dental Surgeon & pet lover 🐾. Loves pottery, acoustic guitar tunes, and late evening Kaveri river breeze.',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.MAN],
    minAge: 24,
    maxAge: 32,
    interests: ['lifestyle-pets', 'music-live', 'arts-reading', 'food-coffee', 'outdoors-hiking'],
    photos: [
      'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&auto=format&fit=crop&q=80',
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
  {
    phone: '+919840881111',
    displayName: 'Vikramadityan',
    dob: '1996-03-20', // 28
    gender: Gender.MAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'FinTech Startup Founder & Badminton player. Big on ambition, morning filter coffee, and weekend indie gigs 🏸☕',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 23,
    maxAge: 30,
    interests: ['fitness-gym', 'food-coffee', 'music-live', 'outdoors-beach', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840882222',
    displayName: 'Ashwin Prasanna',
    dob: '1997-11-28', // 27
    gender: Gender.MAN,
    city: 'Coimbatore',
    region: 'Tamil Nadu',
    bio: 'Mechanical Design Lead @ EV company. Loves mountain trekking, Formula 1, and experimenting with South Indian cooking 🏎️',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 22,
    maxAge: 29,
    interests: ['outdoors-hiking', 'food-cooking', 'fitness-gym', 'lifestyle-gaming', 'lifestyle-travel'],
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840883333',
    displayName: 'Vigneshwaran',
    dob: '1998-05-18', // 26
    gender: Gender.MAN,
    city: 'Madurai',
    region: 'Tamil Nadu',
    bio: 'Digital Marketer & Kollywood trivia geek. Let us grab Jigarthanda and debate the best Mani Ratnam / Vetrimaran movie 🎬🍦',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 22,
    maxAge: 30,
    interests: ['arts-cinema', 'food-street', 'music-bollywood', 'lifestyle-travel', 'arts-photography'],
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840884444',
    displayName: 'Praveen Kumar',
    dob: '1995-08-14', // 29
    gender: Gender.MAN,
    city: 'Salem',
    region: 'Tamil Nadu',
    bio: 'Orthopedic Doctor. Marathon runner, loves retro English rock & AR Rahman 90s hits, looking for a meaningful life partner 🏃‍♂️',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 24,
    maxAge: 31,
    interests: ['fitness-gym', 'music-live', 'arts-reading', 'lifestyle-travel', 'food-coffee'],
    photos: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840885555',
    displayName: 'Gautham Ramachandran',
    dob: '1996-12-02', // 28
    gender: Gender.MAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Sound Designer & Acoustic Guitarist. Big fan of Ilaiyaraaja harmonies, sunset jamming at Marina, and artisanal sourdough 🎸',
    intent: RelationshipIntent.SERIOUS_DATING,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 23,
    maxAge: 30,
    interests: ['music-live', 'music-indie', 'food-coffee', 'outdoors-beach', 'arts-photography'],
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840886666',
    displayName: 'Sanjay Raghuram',
    dob: '1995-04-25', // 29
    gender: Gender.MAN,
    city: 'Chennai',
    region: 'Tamil Nadu',
    bio: 'Corporate M&A Lawyer. Passionate about squash, history documentaries, and exploring authentic Chettinad restaurants 🍛',
    intent: RelationshipIntent.MARRIAGE,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 24,
    maxAge: 31,
    interests: ['food-cooking', 'arts-reading', 'fitness-gym', 'lifestyle-travel', 'food-coffee'],
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
    ],
  },
  {
    phone: '+919840887777',
    displayName: 'Harish Mani',
    dob: '1997-07-19', // 27
    gender: Gender.MAN,
    city: 'Coimbatore',
    region: 'Tamil Nadu',
    bio: 'Estate manager & specialty coffee cultivator in Nilgiris. Hiking trails, stargazing, and fresh mountain brew ☕⛰️',
    intent: RelationshipIntent.LONG_TERM,
    preferredGenderMode: PreferredGenderMode.SELECTED,
    preferredGenders: [Gender.WOMAN],
    minAge: 22,
    maxAge: 29,
    interests: ['food-coffee', 'outdoors-hiking', 'arts-photography', 'lifestyle-travel', 'lifestyle-pets'],
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80',
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

  // 6. Seed Official System Admin Account
  const adminPhone = '+919999999999';
  const existingAdmin = await prisma.user.findUnique({
    where: { phoneNumber: adminPhone },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        phoneNumber: adminPhone,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        phoneVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: 'System Administrator',
            gender: Gender.NON_BINARY,
            bio: 'Truelove Staff System Administrator',
            dateOfBirth: new Date('1990-01-01'),
            locationCity: 'Chennai',
            locationRegion: 'Tamil Nadu',
            status: ProfileStatus.READY,
            visibility: ProfileVisibility.HIDDEN,
          },
        },
      },
    });
    console.log(`🛡️ Seeded official ADMIN user: ${adminPhone}`);
  }

  console.log('🎉 All sample Tamil profiles and admin account successfully seeded!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
