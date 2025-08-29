import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { JobStatus, DocumentType } from '@prisma/client';

export interface CreateJobDto {
  uploadId: string;
  type: DocumentType;
}

export interface JobResponseDto {
  id: string;
  status: JobStatus;
  type: DocumentType;
  uploadId: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  textractJobId?: string | null;
  ocrJsonUrl?: string | null;
}

export interface UpdateJobStatusDto {
  status: JobStatus;
  errorMessage?: string;
  errorCode?: string;
  textractJobId?: string | null;
  ocrJsonKey?: string; // S3 key for OCR results
}

@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(private prisma: PrismaService) {}

  async createJob(data: CreateJobDto, user: JwtPayload): Promise<JobResponseDto> {
    try {
      // Verify upload exists and user has access
      const upload = await this.prisma.upload.findUnique({
        where: { id: data.uploadId },
        select: {
          id: true,
          userId: true,
          status: true,
          job: {
            select: { id: true },
          },
        },
      });

      if (!upload) {
        this.logger.warn(`Job creation attempted for non-existent upload: ${data.uploadId}`);
        throw new NotFoundException('Upload not found');
      }

      // Verify user owns the upload or has admin access
      if (upload.userId !== user.sub && user.role !== 0) {
        this.logger.warn(
          `Unauthorized job creation attempt by user ${user.sub} for upload ${data.uploadId} owned by ${upload.userId}`,
        );
        throw new ForbiddenException('Access denied to this upload');
      }

      // Check if job already exists for this upload
      if (upload.job) {
        this.logger.warn(
          `Job creation attempted for upload ${data.uploadId} which already has job ${upload.job.id}`,
        );
        throw new BadRequestException('Job already exists for this upload');
      }

      // Create job record
      const job = await this.prisma.job.create({
        data: {
          type: data.type,
          status: JobStatus.pending,
          uploadId: data.uploadId,
          userId: user.sub,
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

      this.logger.log(
        `Job ${job.id} created successfully for upload ${data.uploadId} by user ${user.sub} (type: ${data.type})`,
      );
      return job;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2002') {
        this.logger.error(
          `Duplicate job creation attempt for upload ${data.uploadId} by user ${user.sub}`,
        );
        throw new BadRequestException('Job already exists for this upload');
      }

      // Enhanced error logging with context
      this.logger.error(
        `Failed to create job for upload ${data.uploadId}: ${getErrorMessage(error)}`,
        {
          uploadId: data.uploadId,
          userId: user.sub,
          documentType: data.type,
          errorCode,
          stack: getErrorStack(error),
        },
      );
      throw new InternalServerErrorException('Failed to create job');
    }
  }

  /**
   * Validates S3 key format for OCR JSON files
   * @param s3Key The S3 key to validate
   * @returns Object with validation result and error message if invalid
   */
  private validateS3Key(s3Key: string): { isValid: boolean; error?: string } {
    try {
      // Basic type and null checks
      if (!s3Key || typeof s3Key !== 'string') {
        const error = 'S3 key must be a non-empty string';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key });
        return { isValid: false, error };
      }

      // Trim whitespace
      const trimmedKey = s3Key.trim();
      if (trimmedKey !== s3Key) {
        const error = 'S3 key must not contain leading or trailing whitespace';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key });
        return { isValid: false, error };
      }

      // Length validation (reasonable limit for S3 keys)
      if (trimmedKey.length > 255) {
        const error = `S3 key too long: ${trimmedKey.length} characters (max 255)`;
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      if (trimmedKey.length < 5) {
        // Minimum: "ocr/a.json" = 9 chars, but being more lenient
        const error = `S3 key too short: ${trimmedKey.length} characters`;
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      // Security checks: prevent path traversal and malicious patterns
      if (trimmedKey.includes('..')) {
        const error = 'S3 key must not contain path traversal patterns (..)';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      if (trimmedKey.includes('//')) {
        const error = 'S3 key must not contain double slashes (//)';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      // Check for null bytes or other control characters
      for (let i = 0; i < trimmedKey.length; i++) {
        const charCode = trimmedKey.charCodeAt(i);
        if (charCode <= 31 || charCode === 127) {
          const error = 'S3 key must not contain control characters';
          this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
          return { isValid: false, error };
        }
      }

      // S3 key must follow pattern: ocr/{filename}.json
      const s3KeyPattern = /^ocr\/[a-zA-Z0-9\-_]+\.json$/;
      if (!s3KeyPattern.test(trimmedKey)) {
        const error =
          'S3 key must follow pattern "ocr/{filename}.json" with alphanumeric characters, hyphens, and underscores only';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      // Additional validation: ensure filename part is reasonable
      const filenamePart = trimmedKey.substring(4, trimmedKey.length - 5); // Remove "ocr/" and ".json"
      if (filenamePart.length === 0) {
        const error = 'S3 key filename part cannot be empty';
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      if (filenamePart.length > 200) {
        // Leave room for prefix and suffix
        const error = `S3 key filename part too long: ${filenamePart.length} characters (max 200)`;
        this.logger.warn(`S3 key validation failed: ${error}`, { s3Key: trimmedKey });
        return { isValid: false, error };
      }

      // Log successful validation
      this.logger.debug(`S3 key validation successful`, { s3Key: trimmedKey });
      return { isValid: true };
    } catch (error: unknown) {
      const errorMessage = `S3 key validation error: ${getErrorMessage(error)}`;
      this.logger.error(errorMessage, {
        s3Key,
        stack: getErrorStack(error),
      });
      return { isValid: false, error: 'Internal validation error' };
    }
  }

  async updateJobStatus(
    jobId: string,
    updateData: UpdateJobStatusDto,
    user?: JwtPayload,
  ): Promise<JobResponseDto> {
    try {
      // If user is provided, verify they have access
      if (user) {
        const existingJob = await this.prisma.job.findUnique({
          where: { id: jobId },
          select: { userId: true },
        });

        if (!existingJob) {
          this.logger.warn(`Job update attempted for non-existent job: ${jobId}`);
          throw new NotFoundException(`Job with ID ${jobId} not found`);
        }

        // Allow if user owns the job or is admin/internal
        if (existingJob.userId !== user.sub && user.role !== 0 && user.role !== 1) {
          this.logger.warn(
            `Unauthorized job update attempt by user ${user.sub} for job ${jobId} owned by ${existingJob.userId}`,
          );
          throw new ForbiddenException('Access denied to this job');
        }
      }

      // Enhanced validation for textractJobId
      if (updateData.textractJobId !== undefined) {
        if (updateData.textractJobId === null) {
          // Allow null to clear the field
          this.logger.debug(`Clearing textractJobId for job ${jobId}`);
        } else if (typeof updateData.textractJobId !== 'string') {
          this.logger.error(
            `Invalid textractJobId type for job ${jobId}: expected string, got ${typeof updateData.textractJobId}`,
          );
          throw new BadRequestException('textractJobId must be a string when provided');
        } else if (updateData.textractJobId.trim() === '') {
          this.logger.error(`Empty textractJobId provided for job ${jobId}`);
          throw new BadRequestException('textractJobId must be a non-empty string when provided');
        } else if (updateData.textractJobId.length > 255) {
          this.logger.error(
            `textractJobId too long for job ${jobId}: ${updateData.textractJobId.length} characters`,
          );
          throw new BadRequestException('textractJobId must be 255 characters or less');
        } else {
          // Validate textractJobId format (AWS Textract job IDs are typically alphanumeric with hyphens)
          const textractJobIdPattern = /^[a-zA-Z0-9\-_]+$/;
          if (!textractJobIdPattern.test(updateData.textractJobId)) {
            this.logger.error(
              `Invalid textractJobId format for job ${jobId}: ${updateData.textractJobId}`,
            );
            throw new BadRequestException(
              'textractJobId must contain only alphanumeric characters, hyphens, and underscores',
            );
          }
        }
      }

      // Enhanced validation for ocrJsonKey (S3 key for OCR results)
      if (updateData.ocrJsonKey !== undefined) {
        this.logger.debug(`Processing ocrJsonKey for job ${jobId}`, {
          ocrJsonKey: updateData.ocrJsonKey,
          jobId,
        });

        const validation = this.validateS3Key(updateData.ocrJsonKey);
        if (!validation.isValid) {
          this.logger.error(`S3 key validation failed for job ${jobId}`, {
            jobId,
            ocrJsonKey: updateData.ocrJsonKey,
            validationError: validation.error,
            userId: user?.sub || 'internal',
          });
          throw new BadRequestException(validation.error || 'Invalid S3 key format');
        }

        this.logger.log(`S3 key validation successful for job ${jobId}`, {
          jobId,
          ocrJsonKey: updateData.ocrJsonKey,
          userId: user?.sub || 'internal',
        });
      }

      const prismaUpdateData: any = {
        status: updateData.status,
        ...(updateData.errorMessage && { errorMessage: updateData.errorMessage }),
        ...(updateData.errorCode && { errorCode: updateData.errorCode }),
        ...(updateData.textractJobId !== undefined && { textractJobId: updateData.textractJobId }),
        ...(updateData.ocrJsonKey !== undefined && { ocrJsonUrl: updateData.ocrJsonKey }),
      };

      // Set completedAt if job is completed or failed
      if (updateData.status === JobStatus.success || updateData.status === JobStatus.failed) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        prismaUpdateData.completedAt = new Date();
      }

      const job = await this.prisma.job.update({
        where: { id: jobId },
        data: prismaUpdateData,
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

      // Enhanced logging for successful updates with S3 key tracking
      const logContext = {
        jobId,
        status: updateData.status,
        userId: user?.sub || 'internal',
        hasOcrJsonKey: !!updateData.ocrJsonKey,
        hasTextractJobId: !!updateData.textractJobId,
        textractJobIdCleared: updateData.textractJobId === null,
      };

      if (updateData.ocrJsonKey) {
        this.logger.log(
          `Job ${jobId} status updated to ${updateData.status} with S3 OCR data reference`,
          {
            ...logContext,
            ocrJsonKey: updateData.ocrJsonKey,
            operation: 'S3_KEY_STORED',
          },
        );
      } else if (updateData.textractJobId) {
        this.logger.log(
          `Job ${jobId} status updated to ${updateData.status} with textractJobId: ${updateData.textractJobId}`,
          logContext,
        );
      } else if (updateData.textractJobId === null) {
        this.logger.log(
          `Job ${jobId} status updated to ${updateData.status} and textractJobId cleared`,
          logContext,
        );
      } else {
        this.logger.log(`Job ${jobId} status updated to ${updateData.status}`, logContext);
      }

      // Log additional context for failed jobs
      if (updateData.status === JobStatus.failed) {
        this.logger.warn(
          `Job ${jobId} marked as failed - Error: ${updateData.errorMessage || 'No error message'}, Code: ${updateData.errorCode || 'No error code'}`,
        );
      }

      return job;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        this.logger.error(`Job ${jobId} not found during update operation`);
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      // Enhanced error logging with S3 key context
      this.logger.error(`Failed to update job status for job ${jobId}: ${getErrorMessage(error)}`, {
        jobId,
        updateData: {
          status: updateData.status,
          hasTextractJobId: !!updateData.textractJobId,
          hasOcrJsonKey: !!updateData.ocrJsonKey,
          hasErrorMessage: !!updateData.errorMessage,
          hasErrorCode: !!updateData.errorCode,
        },
        s3KeyOperation: updateData.ocrJsonKey
          ? {
              operation: 'S3_KEY_UPDATE_FAILED',
              ocrJsonKey: updateData.ocrJsonKey,
            }
          : undefined,
        userId: user?.sub,
        errorCode,
        stack: getErrorStack(error),
      });
      throw new InternalServerErrorException('Failed to update job status');
    }
  }

  async getJobByUploadId(uploadId: string, user: JwtPayload): Promise<JobResponseDto> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { uploadId },
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

      if (!job) {
        this.logger.debug(`Job lookup failed - no job found for upload: ${uploadId}`);
        throw new NotFoundException(`Job for upload ${uploadId} not found`);
      }

      // Check if user has access (owns job, admin, or internal)
      if (job.userId !== user.sub && user.role !== 0 && user.role !== 1) {
        this.logger.warn(
          `Unauthorized job access attempt by user ${user.sub} for job ${job.id} (upload: ${uploadId}) owned by ${job.userId}`,
        );
        throw new ForbiddenException('Access denied to this job');
      }

      this.logger.debug(
        `Job ${job.id} retrieved successfully for upload ${uploadId} by user ${user.sub}`,
      );
      return job;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to fetch job by upload ID ${uploadId}: ${getErrorMessage(error)}`, {
        uploadId,
        userId: user.sub,
        stack: getErrorStack(error),
      });
      throw new InternalServerErrorException('Failed to fetch job');
    }
  }

  async getJobById(jobId: string, user: JwtPayload): Promise<JobResponseDto> {
    try {
      const job = await this.prisma.job.findUnique({
        where: { id: jobId },
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

      if (!job) {
        this.logger.debug(`Job lookup failed - job not found: ${jobId}`);
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      // Check if user has access (owns job, admin, or internal)
      if (job.userId !== user.sub && user.role !== 0 && user.role !== 1) {
        this.logger.warn(
          `Unauthorized job access attempt by user ${user.sub} for job ${jobId} owned by ${job.userId}`,
        );
        throw new ForbiddenException('Access denied to this job');
      }

      this.logger.debug(`Job ${jobId} retrieved successfully by user ${user.sub}`);
      return job;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to fetch job by ID ${jobId}: ${getErrorMessage(error)}`, {
        jobId,
        userId: user.sub,
        stack: getErrorStack(error),
      });
      throw new InternalServerErrorException('Failed to fetch job');
    }
  }

  async getUserJobs(user: JwtPayload): Promise<JobResponseDto[]> {
    try {
      const jobs = await this.prisma.job.findMany({
        where: { userId: user.sub },
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
        orderBy: { startedAt: 'desc' },
      });

      this.logger.debug(`Retrieved ${jobs.length} jobs for user ${user.sub}`);
      return jobs;
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch jobs for user ${user.sub}: ${getErrorMessage(error)}`, {
        userId: user.sub,
        stack: getErrorStack(error),
      });
      throw new InternalServerErrorException('Failed to fetch user jobs');
    }
  }
}
