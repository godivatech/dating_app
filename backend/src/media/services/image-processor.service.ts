import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImageResult {
  width: number;
  height: number;
  format: string;
  thumbnailBuffer: Buffer;
  mediumBuffer: Buffer;
  largeBuffer: Buffer;
}

const MIN_DIMENSION = 300;
const MAX_DIMENSION = 6000;
const MAX_PIXELS = 36_000_000; // 6000 x 6000

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  /**
   * Validates, strips EXIF, and generates 3 optimized WebP derivatives.
   */
  async processImage(buffer: Buffer): Promise<ProcessedImageResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Image buffer is empty.');
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(buffer, {
        limitInputPixels: MAX_PIXELS,
      }).metadata();
    } catch (err: any) {
      throw new BadRequestException(
        `Failed to decode image or unsupported format: ${err.message}`,
      );
    }

    const format = metadata.format?.toLowerCase();
    if (!format || !ALLOWED_FORMATS.has(format)) {
      throw new BadRequestException(
        `Unsupported image format "${format}". Allowed formats are JPEG, PNG, and WebP.`,
      );
    }

    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      throw new BadRequestException(
        `Image dimensions (${width}x${height}) are too small. Minimum required is ${MIN_DIMENSION}x${MIN_DIMENSION}px.`,
      );
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new BadRequestException(
        `Image dimensions (${width}x${height}) exceed maximum allowed dimension of ${MAX_DIMENSION}px.`,
      );
    }

    try {
      // 1. Generate 300x300 thumbnail (cover/crop, WebP, quality 80)
      const thumbnailBuffer = await sharp(buffer, {
        limitInputPixels: MAX_PIXELS,
      })
        .rotate() // Auto-rotate according to EXIF orientation before stripping
        .resize(300, 300, { fit: 'cover', position: 'center' })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      // 2. Generate 720x960 medium derivative (inside/fit, WebP, quality 85)
      const mediumBuffer = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize(720, 960, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      // 3. Generate 1080x1440 large derivative (inside/fit, WebP, quality 85)
      const largeBuffer = await sharp(buffer, { limitInputPixels: MAX_PIXELS })
        .rotate()
        .resize(1080, 1440, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      return {
        width,
        height,
        format,
        thumbnailBuffer,
        mediumBuffer,
        largeBuffer,
      };
    } catch (err: any) {
      this.logger.error(
        `Error during image derivative generation: ${err.message}`,
      );
      throw new BadRequestException(`Image processing failed: ${err.message}`);
    }
  }
}
