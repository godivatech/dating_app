export const PHOTO_PROCESSING_QUEUE = 'photo-processing';
export const PHOTO_QUEUE_TOKEN = `BullQueue_${PHOTO_PROCESSING_QUEUE}`;

export interface PhotoProcessingJobData {
  photoId: string;
}
