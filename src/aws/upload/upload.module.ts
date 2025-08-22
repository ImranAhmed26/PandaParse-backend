import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadRecordService } from './upload.service';
import { S3UploadUrlModule } from '../s3-upload-url/s3-upload-url.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AwsSqsModule } from '../sqs/aws-sqs.module';
import { DocumentModule } from '../../document/document.module';
import { JobModule } from '../../job/job.module';

@Module({
  imports: [S3UploadUrlModule, PrismaModule, AwsSqsModule, DocumentModule, JobModule],
  controllers: [UploadController],
  providers: [UploadRecordService],
  exports: [UploadRecordService],
})
export class UploadModule {}
