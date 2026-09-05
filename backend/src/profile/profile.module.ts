import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './services/profile.service';
import { ProfileCompletionService } from './services/profile-completion.service';
import { InterestsService } from './services/interests.service';

import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MediaModule),
    forwardRef(() => SafetyModule),
  ],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileCompletionService, InterestsService],
  exports: [ProfileService, ProfileCompletionService, InterestsService],
})
export class ProfileModule {}
