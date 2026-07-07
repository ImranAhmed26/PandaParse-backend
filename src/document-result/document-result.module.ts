import { Module } from '@nestjs/common';
import { DocumentResultController } from './document-result.controller';
import { DocumentResultService } from './document-result.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3ObjectModule } from '../aws/s3-object/s3-object.module';

@Module({
  imports: [PrismaModule, S3ObjectModule],
  controllers: [DocumentResultController],
  providers: [DocumentResultService],
  exports: [DocumentResultService],
})
export class DocumentResultModule {}