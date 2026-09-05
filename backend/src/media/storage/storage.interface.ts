export interface StorageObjectMetadata {
  contentLength: number;
  contentType: string;
}

export interface StorageService {
  /**
   * Generates a short-lived presigned PUT URL for direct client-to-R2 upload.
   */
  createUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string>;

  /**
   * Checks if an object exists and returns its basic metadata.
   */
  headObject(key: string): Promise<StorageObjectMetadata | null>;

  /**
   * Downloads an object with strict memory bounds.
   */
  getObject(key: string): Promise<Buffer>;

  /**
   * Uploads an object buffer to storage.
   */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;

  /**
   * Deletes a single object from storage.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Deletes multiple objects in a single batch operation.
   */
  deleteObjects(keys: string[]): Promise<void>;

  /**
   * Constructs the public CDN URL for an approved derivative object key.
   */
  getPublicUrl(key: string): string;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
