import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AwsSqsService } from '../sqs/aws-sqs.service';

describe('Upload Error Handling', () => {
  let _awsSqsService: AwsSqsService;
  let _loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AwsSqsService],
    }).compile();

    _awsSqsService = module.get<AwsSqsService>(AwsSqsService);
    _loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('SQS Error Handling', () => {
    it('should handle missing queue URL gracefully', async () => {
      // Mock environment without SQS_QUEUE_URL
      const originalQueueUrl = process.env.SQS_QUEUE_URL;
      delete process.env.SQS_QUEUE_URL;

      // Create new service instance without queue URL
      const module: TestingModule = await Test.createTestingModule({
        providers: [AwsSqsService],
      }).compile();

      const service = module.get<AwsSqsService>(AwsSqsService);

      const jobData = {
        jobId: 'test-job-id',
        uploadId: 'test-upload-id',
        documentId: 'test-document-id',
        s3Key: 'test/file.pdf',
        documentType: 'INVOICE',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        timestamp: new Date().toISOString(),
      };

      await expect(service.sendProcessingMessage(jobData)).rejects.toThrow(
        'SQS_QUEUE_URL not configured. Cannot send processing message.',
      );

      // Restore original environment
      if (originalQueueUrl) {
        process.env.SQS_QUEUE_URL = originalQueueUrl;
      }
    });

    it('should validate processing message data', async () => {
      // Set a mock queue URL first
      process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

      // Create new service instance with queue URL
      const module: TestingModule = await Test.createTestingModule({
        providers: [AwsSqsService],
      }).compile();

      const service = module.get<AwsSqsService>(AwsSqsService);

      const invalidJobData = {
        jobId: '',
        uploadId: 'test-upload-id',
        documentId: 'test-document-id',
        s3Key: 'test/file.pdf',
        documentType: 'INVOICE',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        timestamp: new Date().toISOString(),
      };

      await expect(service.sendProcessingMessage(invalidJobData)).rejects.toThrow(
        'Missing required fields in processing message: jobId',
      );
    });

    it('should validate S3 key format', async () => {
      // Set a mock queue URL first
      process.env.SQS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

      // Create new service instance with queue URL
      const module: TestingModule = await Test.createTestingModule({
        providers: [AwsSqsService],
      }).compile();

      const service = module.get<AwsSqsService>(AwsSqsService);

      const invalidJobData = {
        jobId: 'test-job-id',
        uploadId: 'test-upload-id',
        documentId: 'test-document-id',
        s3Key: 'invalid key with spaces!',
        documentType: 'INVOICE',
        userId: 'test-user-id',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        timestamp: new Date().toISOString(),
      };

      await expect(service.sendProcessingMessage(invalidJobData)).rejects.toThrow(
        'Invalid S3 key format: invalid key with spaces!',
      );
    });
  });
});
