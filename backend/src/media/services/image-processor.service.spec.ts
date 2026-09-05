import { ImageProcessorService } from './image-processor.service';
import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  it('should process a valid JPEG and generate 3 WebP derivatives with correct dimensions', async () => {
    // Generate valid 800x800 red JPEG buffer
    const inputBuffer = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await service.processImage(inputBuffer);

    expect(result).toBeDefined();
    expect(result.width).toBe(800);
    expect(result.height).toBe(800);
    expect(result.format).toBe('jpeg');
    expect(result.thumbnailBuffer).toBeDefined();
    expect(result.mediumBuffer).toBeDefined();
    expect(result.largeBuffer).toBeDefined();

    // Verify thumbnail is 300x300 WebP
    const thumbMeta = await sharp(result.thumbnailBuffer).metadata();
    expect(thumbMeta.format).toBe('webp');
    expect(thumbMeta.width).toBe(300);
    expect(thumbMeta.height).toBe(300);

    // Verify medium is WebP
    const mediumMeta = await sharp(result.mediumBuffer).metadata();
    expect(mediumMeta.format).toBe('webp');
    expect(mediumMeta.width).toBeLessThanOrEqual(720);
    expect(mediumMeta.height).toBeLessThanOrEqual(960);
  });

  it('should process a valid PNG buffer', async () => {
    const inputBuffer = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 4,
        background: { r: 0, g: 128, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.processImage(inputBuffer);
    expect(result.format).toBe('png');
    expect(result.thumbnailBuffer.length).toBeGreaterThan(0);
  });

  it('should reject images with dimensions smaller than 300x300', async () => {
    const smallBuffer = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    await expect(service.processImage(smallBuffer)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject corrupt / non-image buffers', async () => {
    const corruptBuffer = Buffer.from('this is not an image file');
    await expect(service.processImage(corruptBuffer)).rejects.toThrow(
      BadRequestException,
    );
  });
});
