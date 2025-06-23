import { Module } from '@nestjs/common';
import { S3UploadUrlService } from './s3-upload-url.service';

@Module({
  providers: [S3UploadUrlService],
  exports: [S3UploadUrlService],
})
export class S3UploadUrlModule {}
