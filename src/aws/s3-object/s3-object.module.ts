import { Module } from '@nestjs/common';
import { S3ObjectService } from './s3-object.service';

// ConfigModule is registered globally in AppModule, so ConfigService is injectable here.
@Module({
  providers: [S3ObjectService],
  exports: [S3ObjectService],
})
export class S3ObjectModule {}
