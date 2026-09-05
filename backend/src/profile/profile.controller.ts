import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileService } from './services/profile.service';
import { InterestsService } from './services/interests.service';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UpdateAboutLocationDto } from './dto/update-about-location.dto';
import { UpdateVisibilityDto } from './dto/update-visibility.dto';

@Controller()
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly interestsService: InterestsService,
  ) {}

  @Get('interests')
  async getActiveInterests() {
    return this.interestsService.getActiveInterests();
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/me')
  async getMyProfile(@CurrentUser('userId') userId: string) {
    return this.profileService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/completion')
  async getCompletion(@CurrentUser('userId') userId: string) {
    return this.profileService.getCompletion(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/identity')
  @HttpCode(HttpStatus.OK)
  async updateIdentity(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateIdentityDto,
  ) {
    return this.profileService.updateIdentity(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/preferences')
  @HttpCode(HttpStatus.OK)
  async updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.profileService.updatePreferences(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/interests')
  @HttpCode(HttpStatus.OK)
  async updateInterests(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateInterestsDto,
  ) {
    return this.profileService.updateInterests(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile/about-location')
  @HttpCode(HttpStatus.OK)
  async updateAboutLocation(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateAboutLocationDto,
  ) {
    return this.profileService.updateAboutLocation(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile/visibility')
  @HttpCode(HttpStatus.OK)
  async updateVisibility(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.profileService.updateVisibility(userId, dto.visibility);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile/view/:profileId')
  async getViewableProfile(
    @CurrentUser('userId') requesterUserId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.profileService.getViewableProfile(requesterUserId, profileId);
  }
}
