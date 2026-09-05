import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Interest, InterestStatus } from '@prisma/client';

export const DEFAULT_INTERESTS: Array<{
  id: string;
  name: string;
  category: string;
}> = [
  // Outdoors & Nature
  { id: 'outdoors-hiking', name: 'Hiking', category: 'Outdoors' },
  { id: 'outdoors-camping', name: 'Camping', category: 'Outdoors' },
  { id: 'outdoors-cycling', name: 'Cycling', category: 'Outdoors' },
  { id: 'outdoors-beach', name: 'Beach Trips', category: 'Outdoors' },

  // Music & Entertainment
  { id: 'music-live', name: 'Live Music', category: 'Music' },
  { id: 'music-indie', name: 'Indie & Alternative', category: 'Music' },
  { id: 'music-electronic', name: 'Electronic / EDM', category: 'Music' },
  { id: 'music-bollywood', name: 'Bollywood & Classical', category: 'Music' },

  // Food & Drink
  { id: 'food-cooking', name: 'Cooking at Home', category: 'Food & Drink' },
  { id: 'food-coffee', name: 'Coffee & Cafes', category: 'Food & Drink' },
  { id: 'food-street', name: 'Street Food', category: 'Food & Drink' },
  { id: 'food-wine', name: 'Wine & Dining', category: 'Food & Drink' },

  // Fitness & Sports
  { id: 'fitness-gym', name: 'Gym & Lifting', category: 'Fitness & Sports' },
  { id: 'fitness-yoga', name: 'Yoga & Pilates', category: 'Fitness & Sports' },
  {
    id: 'fitness-running',
    name: 'Running / Marathons',
    category: 'Fitness & Sports',
  },
  { id: 'sports-cricket', name: 'Cricket', category: 'Fitness & Sports' },
  { id: 'sports-football', name: 'Football', category: 'Fitness & Sports' },

  // Arts & Culture
  { id: 'arts-photography', name: 'Photography', category: 'Arts & Culture' },
  { id: 'arts-reading', name: 'Reading & Books', category: 'Arts & Culture' },
  { id: 'arts-cinema', name: 'Cinema & Film', category: 'Arts & Culture' },
  {
    id: 'arts-museums',
    name: 'Art Galleries & Museums',
    category: 'Arts & Culture',
  },

  // Lifestyle & Hobbies
  {
    id: 'lifestyle-travel',
    name: 'Travel & Backpacking',
    category: 'Lifestyle',
  },
  { id: 'lifestyle-pets', name: 'Dogs & Pets', category: 'Lifestyle' },
  {
    id: 'lifestyle-gaming',
    name: 'Board Games & Video Games',
    category: 'Lifestyle',
  },
  { id: 'lifestyle-tech', name: 'Tech & Startups', category: 'Lifestyle' },
];

@Injectable()
export class InterestsService implements OnModuleInit {
  private readonly logger = new Logger(InterestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultInterests();
  }

  async seedDefaultInterests(): Promise<void> {
    try {
      const count = await this.prisma.interest.count();
      if (count === 0) {
        this.logger.log(
          'Seeding initial reference interests into PostgreSQL...',
        );
        for (const item of DEFAULT_INTERESTS) {
          await this.prisma.interest.upsert({
            where: { id: item.id },
            update: {},
            create: {
              id: item.id,
              name: item.name,
              category: item.category,
              status: InterestStatus.ACTIVE,
            },
          });
        }
        this.logger.log(
          `Successfully seeded ${DEFAULT_INTERESTS.length} reference interests.`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not seed interests during boot: ${error.message}`,
      );
    }
  }

  async getActiveInterests(): Promise<Interest[]> {
    return this.prisma.interest.findMany({
      where: { status: InterestStatus.ACTIVE },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async validateInterestIds(
    interestIds: string[],
  ): Promise<{ isValid: boolean; invalidIds: string[] }> {
    if (!interestIds || interestIds.length === 0) {
      return { isValid: true, invalidIds: [] };
    }

    const uniqueIds = Array.from(new Set(interestIds));
    const activeInterests = await this.prisma.interest.findMany({
      where: {
        id: { in: uniqueIds },
        status: InterestStatus.ACTIVE,
      },
      select: { id: true },
    });

    const activeSet = new Set(activeInterests.map((item) => item.id));
    const invalidIds = uniqueIds.filter((id) => !activeSet.has(id));

    return {
      isValid: invalidIds.length === 0,
      invalidIds,
    };
  }
}
