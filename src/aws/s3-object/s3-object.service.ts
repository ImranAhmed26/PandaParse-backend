import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Read-side S3 access for the Document Editor:
 *  - presigned GET URLs for the original uploaded file (input bucket)
 *  - reading the parsed Textract JSON written by the result Lambda (output bucket)
 *
 * Kept separate from S3UploadUrlService, which owns the write/upload path.
 */
@Injectable()
export class S3ObjectService {
  private readonly logger = new Logger(S3ObjectService.name);
  private readonly s3: S3Client;
  private readonly inputBucket: string;
  private readonly outputBucket: string;
  private readonly downloadUrlTtl = 900; // 15 minutes

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION') as string,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') as string,
      },
    });
    this.inputBucket = this.config.get<string>('S3_BUCKET_NAME') as string;
    this.outputBucket = this.config.get<string>('TEXTRACT_OUTPUT_BUCKET') as string;
  }

  /**
   * Presigned GET URL for viewing/downloading the original document file from the
   * input bucket. Expires after `downloadUrlTtl` seconds.
   */
  async getDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.inputBucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: this.downloadUrlTtl });
  }

  /**
   * Fetch and parse a JSON object from the parsed/output bucket (the raw Textract
   * result). Returns null on any failure so a missing/corrupt result never breaks
   * the editor — the file viewer can still render without extracted data.
   */
  async getJson<T = unknown>(key: string): Promise<T | null> {
    try {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.outputBucket, Key: key }),
      );
      if (!res.Body) return null;
      const body = await res.Body.transformToString();
      return JSON.parse(body) as T;
    } catch (error) {
      this.logger.warn(
        `Failed to read parsed JSON from S3 (key=${key}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
