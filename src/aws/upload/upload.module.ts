import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { S3UploadUrlModule } from '../s3-upload-url/s3-upload-url.module';

@Module({
  imports: [S3UploadUrlModule],
  controllers: [UploadController],
})
export class UploadModule {}
