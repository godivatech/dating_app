import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService, StorageObjectMetadata } from './storage.interface';
import { Readable } from 'stream';

const MAX_PHOTO_FILE_SIZE = 10 * 1024 * 1024; // 10MB strict limit

@Injectable()
export class R2StorageService implements StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID') || '';
    const accessKeyId =
      this.configService.get<string>('R2_ACCESS_KEY_ID') || '';
    const secretAccessKey =
      this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '';
    this.bucketName =
      this.configService.get<string>('R2_BUCKET_NAME') || 'dating-app-media';
    this.publicBaseUrl = (
      this.configService.get<string>('R2_PUBLIC_BASE_URL') ||
      'https://media.datingapp.local'
    ).replace(/\/$/, '');

    const endpoint =
      this.configService.get<string>('R2_ENDPOINT') ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async headObject(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      return {
        contentLength: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      this.logger.warn(`headObject failed for key ${key}: ${err.message}`);
      return null;
    }
  }

  async getObject(key: string): Promise<Buffer> {
    // 1. Strict size verification before allocating buffer
    const head = await this.headObject(key);
    if (!head) {
      throw new Error(`Object not found in storage: ${key}`);
    }
    if (head.contentLength > MAX_PHOTO_FILE_SIZE) {
      throw new Error(
        `Object size ${head.contentLength} exceeds maximum allowed size of ${MAX_PHOTO_FILE_SIZE} bytes`,
      );
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`Empty response body for object ${key}`);
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    let receivedBytes = 0;

    return new Promise<Buffer>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_PHOTO_FILE_SIZE) {
          stream.destroy(
            new Error(
              `Object stream exceeded maximum size limit of ${MAX_PHOTO_FILE_SIZE} bytes`,
            ),
          );
          return;
        }
        chunks.push(chunk);
      });

      stream.on('error', (err) => {
        reject(err);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (body.length > MAX_PHOTO_FILE_SIZE) {
      throw new Error(
        `Buffer size ${body.length} exceeds maximum limit of ${MAX_PHOTO_FILE_SIZE} bytes`,
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (err: any) {
      this.logger.warn(`Failed to delete object ${key}: ${err.message}`);
    }
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map((k) => ({ Key: k })),
          Quiet: true,
        },
      });
      await this.s3Client.send(command);
    } catch (err: any) {
      this.logger.warn(
        `Failed to batch delete objects [${keys.join(', ')}]: ${err.message}`,
      );
    }
  }

  getPublicUrl(key: string): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) {
      return key;
    }
    return `${this.publicBaseUrl}/${key.replace(/^\//, '')}`;
  }
}
