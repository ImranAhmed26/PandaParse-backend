import { Test, TestingModule } from '@nestjs/testing';
import { DocumentResultController } from './document-result.controller';

describe('DocumentResultController', () => {
  let controller: DocumentResultController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentResultController],
    }).compile();

    controller = module.get<DocumentResultController>(DocumentResultController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
