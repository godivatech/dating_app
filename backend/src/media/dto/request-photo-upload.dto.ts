import { IsIn, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
export const MIN_PHOTO_BYTES = 1024; // 1KB

export class RequestPhotoUploadDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'Allowed MIME types are image/jpeg, image/png, and image/webp.',
  })
  mimeType: string;

  @IsInt()
  @Min(MIN_PHOTO_BYTES, { message: 'File size is too small (minimum 1KB).' })
  @Max(MAX_PHOTO_BYTES, {
    message: 'File size exceeds maximum allowed limit of 10MB.',
  })
  fileSize: number;
}
