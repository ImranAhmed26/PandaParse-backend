import { Module } from '@nestjs/common';
import { DocumentResultController } from './document-result.controller';
import { DocumentResultService } from './document-result.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentResultController],
  providers: [DocumentResultService],
  exports: [DocumentResultService],
})
export class DocumentResultModule {}