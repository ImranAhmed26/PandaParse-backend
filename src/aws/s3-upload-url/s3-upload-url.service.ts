import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3UploadUrlService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') as string,
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') as string,
      },
    });
    const bucketName = this.configService.get('S3_BUCKET_NAME');
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME is not defined');
    }
    this.bucket = bucketName;
  }

  async generateUploadUrl(fileType: string): Promise<{ url: string; key: string }> {
    const key = `uploads/${uuidv4()}.${fileType}`;
   const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: this.mapMimeType(fileType),
      ACL: 'private',
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    return { url, key };
  }

  private mapMimeType(ext: string): string {
    const map = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return map[ext.toLowerCase()] || 'application/octet-stream';
  }
}
