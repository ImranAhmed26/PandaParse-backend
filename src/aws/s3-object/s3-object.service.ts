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
  // Short TTL: the presigned URL only needs to survive the editor's initial file load.
  // Kept tight so a leaked/shared link (it's a bearer URL) stops working quickly.
  private readonly downloadUrlTtl = 120; // 2 minutes

  constructor(private readonly config: ConfigService) {
    // Trim env values: a stray space or CRLF newline in a bucket name makes the AWS
    // SDK treat it as an ARN and throw "Invalid ARN", which is hard to diagnose.
    const env = (key: string) => (this.config.get<string>(key) ?? '').trim();

    this.s3 = new S3Client({
      region: env('AWS_REGION'),
      credentials: {
        accessKeyId: env('AWS_ACCESS_KEY_ID'),
        secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.inputBucket = env('S3_BUCKET_NAME');
    this.outputBucket = env('TEXTRACT_OUTPUT_BUCKET');
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
