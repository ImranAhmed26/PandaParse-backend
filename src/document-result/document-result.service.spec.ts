import { Test, TestingModule } from '@nestjs/testing';
import { DocumentResultService } from './document-result.service';

describe('DocumentResultService', () => {
  let service: DocumentResultService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentResultService],
    }).compile();

    service = module.get<DocumentResultService>(DocumentResultService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
