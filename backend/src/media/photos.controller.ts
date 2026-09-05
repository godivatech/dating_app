import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PhotosService } from './services/photos.service';
import { RequestPhotoUploadDto } from './dto/request-photo-upload.dto';
import { ReorderPhotosDto } from './dto/reorder-photos.dto';
import { ModeratePhotoDto } from './dto/moderate-photo.dto';
import {
  SafeProfilePhoto,
  RequestPhotoUploadResponse,
} from '../../../shared/src/types';

@Controller('profile/photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  /**
   * Request a short-lived presigned upload URL for direct mobile-to-R2 upload.
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async requestUploadUrl(
    @Req() req: any,
    @Body() dto: RequestPhotoUploadDto,
  ): Promise<RequestPhotoUploadResponse> {
    const userId = req.user.userId;
    return this.photosService.requestUploadUrl(userId, dto);
  }

  /**
   * Idempotent upload finalization endpoint.
   * Verifies R2 object existence and queues background image processing.
   */
  @Post(':photoId/complete')
  @HttpCode(HttpStatus.OK)
  async completeUpload(
    @Req() req: any,
    @Param('photoId') photoId: string,
  ): Promise<SafeProfilePhoto> {
    const userId = req.user.userId;
    return this.photosService.completeUpload(userId, photoId);
  }

  /**
   * Retrieves all active/non-deleted photos for the authenticated user.
   */
  @Get()
  async getPhotos(@Req() req: any): Promise<SafeProfilePhoto[]> {
    const userId = req.user.userId;
    return this.photosService.getPhotos(userId);
  }

  /**
   * Sets an approved photo as primary (shifts to position 0).
   */
  @Patch(':photoId/primary')
  async setPrimary(
    @Req() req: any,
    @Param('photoId') photoId: string,
  ): Promise<SafeProfilePhoto[]> {
    const userId = req.user.userId;
    return this.photosService.setPrimary(userId, photoId);
  }

  /**
   * Reorders approved photos atomically.
   */
  @Patch('reorder')
  async reorderPhotos(
    @Req() req: any,
    @Body() dto: ReorderPhotosDto,
  ): Promise<SafeProfilePhoto[]> {
    const userId = req.user.userId;
    return this.photosService.reorderPhotos(userId, dto);
  }

  /**
   * Deletes a photo, re-indexes remaining approved photos, and triggers async R2 cleanup.
   */
  @Delete(':photoId')
  async deletePhoto(
    @Req() req: any,
    @Param('photoId') photoId: string,
  ): Promise<SafeProfilePhoto[]> {
    const userId = req.user.userId;
    return this.photosService.deletePhoto(userId, photoId);
  }

  /**
   * Test/moderation helper endpoint to approve or reject a photo.
   */
  @Post(':photoId/moderate')
  @HttpCode(HttpStatus.OK)
  async moderatePhoto(
    @Param('photoId') photoId: string,
    @Body() dto: ModeratePhotoDto,
  ): Promise<SafeProfilePhoto> {
    return this.photosService.moderatePhoto(photoId, dto);
  }
}
