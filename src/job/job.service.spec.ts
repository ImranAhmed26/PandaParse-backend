import { Test, TestingModule } from '@nestjs/testing';
import { JobService, UpdateJobStatusDto } from './job.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobStatus, DocumentType } from '@prisma/client';

describe('JobService', () => {
  let service: JobService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    job: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    upload: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateJobStatus', () => {
    const mockJob = {
      id: 'job-123',
      status: JobStatus.success,
      type: DocumentType.INVOICE,
      uploadId: 'upload-123',
      userId: 'user-123',
      startedAt: new Date(),
      completedAt: new Date(),
      errorMessage: null,
      errorCode: null,
      textractJobId: 'textract-job-123',
    };

    it('should update job status with textractJobId', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'textract-job-123',
      };

      mockPrismaService.job.findUnique.mockResolvedValue({ userId: 'user-123' });
      mockPrismaService.job.update.mockResolvedValue(mockJob);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.success,
          textractJobId: 'textract-job-123',
          completedAt: expect.any(Date),
        },
        select: {
          id: true,
          status: true,
          type: true,
          uploadId: true,
          userId: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          errorCode: true,
          textractJobId: true,
          ocrJsonUrl: true,
        },
      });

      expect(result).toEqual(mockJob);
    });

    it('should update job status without textractJobId', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.processing,
      };

      const mockJobWithoutTextract = { ...mockJob, textractJobId: null };
      mockPrismaService.job.update.mockResolvedValue(mockJobWithoutTextract);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.processing,
        },
        select: {
          id: true,
          status: true,
          type: true,
          uploadId: true,
          userId: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          errorCode: true,
          textractJobId: true,
          ocrJsonUrl: true,
        },
      });

      expect(result).toEqual(mockJobWithoutTextract);
    });

    it('should throw BadRequestException for empty textractJobId', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: '',
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'textractJobId must be a non-empty string when provided',
      );
    });

    it('should throw BadRequestException for non-string textractJobId', async () => {
      const updateData: any = {
        status: JobStatus.success,
        textractJobId: 123,
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'textractJobId must be a string when provided',
      );
    });

    it('should throw BadRequestException for textractJobId that is too long', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'a'.repeat(256), // 256 characters, exceeds 255 limit
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'textractJobId must be 255 characters or less',
      );
    });

    it('should throw BadRequestException for textractJobId with invalid characters', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'invalid@job#id!',
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'textractJobId must contain only alphanumeric characters, hyphens, and underscores',
      );
    });

    it('should allow null textractJobId to clear the field', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.processing,
        textractJobId: null,
      };

      const mockJobWithNullTextract = { ...mockJob, textractJobId: null };
      mockPrismaService.job.update.mockResolvedValue(mockJobWithNullTextract);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.processing,
          textractJobId: null,
        },
        select: expect.any(Object),
      });

      expect(result).toEqual(mockJobWithNullTextract);
    });

    it('should accept valid textractJobId with alphanumeric characters, hyphens, and underscores', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'valid-textract_job-123',
      };

      const mockJobWithValidTextract = { ...mockJob, textractJobId: 'valid-textract_job-123' };
      mockPrismaService.job.update.mockResolvedValue(mockJobWithValidTextract);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.success,
          textractJobId: 'valid-textract_job-123',
          completedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });

      expect(result).toEqual(mockJobWithValidTextract);
    });

    it('should set completedAt when job status is success or failed', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.failed,
        errorMessage: 'Processing failed',
        textractJobId: 'textract-job-123',
      };

      mockPrismaService.job.update.mockResolvedValue(mockJob);

      await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.failed,
          errorMessage: 'Processing failed',
          textractJobId: 'textract-job-123',
          completedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });
    });

    it('should handle database errors gracefully', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'textract-job-123',
      };

      const dbError = new Error('Database connection failed');
      mockPrismaService.job.update.mockRejectedValue(dbError);

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'Failed to update job status',
      );
    });

    it('should handle Prisma P2025 error (record not found)', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
      };

      const prismaError = { code: 'P2025', message: 'Record not found' };
      mockPrismaService.job.update.mockRejectedValue(prismaError);

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'Job with ID job-123 not found',
      );
    });

    // Tests for ocrJsonKey functionality
    it('should update job status with valid ocrJsonKey', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        ocrJsonKey: 'ocr/job-123.json',
      };

      const mockJobWithOcrKey = { ...mockJob, ocrJsonUrl: 'ocr/job-123.json' };
      mockPrismaService.job.update.mockResolvedValue(mockJobWithOcrKey);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.success,
          ocrJsonUrl: 'ocr/job-123.json',
          completedAt: expect.any(Date),
        },
        select: {
          id: true,
          status: true,
          type: true,
          uploadId: true,
          userId: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          errorCode: true,
          textractJobId: true,
          ocrJsonUrl: true,
        },
      });

      expect(result).toEqual(mockJobWithOcrKey);
    });

    it('should update job status with both textractJobId and ocrJsonKey', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        textractJobId: 'textract-job-123',
        ocrJsonKey: 'ocr/job-123.json',
      };

      const mockJobWithBoth = { ...mockJob, ocrJsonUrl: 'ocr/job-123.json' };
      mockPrismaService.job.update.mockResolvedValue(mockJobWithBoth);

      const result = await service.updateJobStatus('job-123', updateData);

      expect(mockPrismaService.job.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: {
          status: JobStatus.success,
          textractJobId: 'textract-job-123',
          ocrJsonUrl: 'ocr/job-123.json',
          completedAt: expect.any(Date),
        },
        select: expect.any(Object),
      });

      expect(result).toEqual(mockJobWithBoth);
    });

    it('should throw BadRequestException for empty ocrJsonKey', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        ocrJsonKey: '',
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'S3 key must be a non-empty string',
      );
    });

    it('should throw BadRequestException for non-string ocrJsonKey', async () => {
      const updateData: any = {
        status: JobStatus.success,
        ocrJsonKey: 123,
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'S3 key must be a non-empty string',
      );
    });

    it('should throw BadRequestException for ocrJsonKey with invalid format', async () => {
      const invalidKeys = [
        'invalid-key.json', // Missing ocr/ prefix
        'ocr/file.txt', // Wrong extension
        'ocr/../file.json', // Path traversal
        'ocr//file.json', // Double slash
        'ocr/file@name.json', // Invalid characters
        'ocr/.json', // Empty filename
        'ocr/' + 'a'.repeat(250) + '.json', // Too long
      ];

      for (const invalidKey of invalidKeys) {
        const updateData: UpdateJobStatusDto = {
          status: JobStatus.success,
          ocrJsonKey: invalidKey,
        };

        await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('should throw BadRequestException for ocrJsonKey with whitespace issues', async () => {
      const invalidKeys = [
        ' ocr/file.json', // Leading whitespace
        'ocr/file.json ', // Trailing whitespace
        ' ocr/file.json ', // Both leading and trailing whitespace
      ];

      for (const invalidKey of invalidKeys) {
        const updateData: UpdateJobStatusDto = {
          status: JobStatus.success,
          ocrJsonKey: invalidKey,
        };

        await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
          'S3 key must not contain leading or trailing whitespace',
        );
      }
    });

    it('should throw BadRequestException for ocrJsonKey that is too short', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        ocrJsonKey: 'a.j', // Too short
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'S3 key too short',
      );
    });

    it('should throw BadRequestException for ocrJsonKey with control characters', async () => {
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        ocrJsonKey: 'ocr/file\x00.json', // Contains null byte
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'S3 key must not contain control characters',
      );
    });

    it('should throw BadRequestException for ocrJsonKey with filename part too long', async () => {
      const longFilename = 'a'.repeat(201); // 201 characters, exceeds 200 limit
      const updateData: UpdateJobStatusDto = {
        status: JobStatus.success,
        ocrJsonKey: `ocr/${longFilename}.json`,
      };

      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateJobStatus('job-123', updateData)).rejects.toThrow(
        'S3 key filename part too long',
      );
    });

    it('should accept valid ocrJsonKey formats', async () => {
      const validKeys = [
        'ocr/job-123.json',
        'ocr/job_456.json',
        'ocr/JOB789.json',
        'ocr/job-abc-def_123.json',
      ];

      for (const validKey of validKeys) {
        const updateData: UpdateJobStatusDto = {
          status: JobStatus.success,
          ocrJsonKey: validKey,
        };

        const mockJobWithValidKey = { ...mockJob, ocrJsonUrl: validKey };
        mockPrismaService.job.update.mockResolvedValue(mockJobWithValidKey);

        const result = await service.updateJobStatus('job-123', updateData);

        expect(mockPrismaService.job.update).toHaveBeenCalledWith({
          where: { id: 'job-123' },
          data: {
            status: JobStatus.success,
            ocrJsonUrl: validKey,
            completedAt: expect.any(Date),
          },
          select: expect.any(Object),
        });

        expect(result).toEqual(mockJobWithValidKey);

        // Clear mock for next iteration
        mockPrismaService.job.update.mockClear();
      }
    });
  });
});
