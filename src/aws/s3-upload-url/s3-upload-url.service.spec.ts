import { Test, TestingModule } from '@nestjs/testing';
import { S3UploadUrlService } from './s3-upload-url.service';

describe('S3UploadUrlService', () => {
  let service: S3UploadUrlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3UploadUrlService],
    }).compile();

    service = module.get<S3UploadUrlService>(S3UploadUrlService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
