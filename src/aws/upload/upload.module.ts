import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadRecordService } from './upload-record.service';
import { S3UploadUrlModule } from '../s3-upload-url/s3-upload-url.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [S3UploadUrlModule, PrismaModule],
  controllers: [UploadController],
  providers: [UploadRecordService],
  exports: [UploadRecordService],
})
export class UploadModule {}
