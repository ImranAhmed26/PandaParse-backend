import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { S3ObjectModule } from '../aws/s3-object/s3-object.module';

@Module({
  imports: [PrismaModule, S3ObjectModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
