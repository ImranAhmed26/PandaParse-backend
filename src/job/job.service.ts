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
        throw new NotFoundException('Upload not found');
      }

      // Verify user owns the upload or has admin access
      if (upload.userId !== user.sub && user.role !== 0) {
        throw new ForbiddenException('Access denied to this upload');
      }

      // Check if job already exists for this upload
      if (upload.job) {
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
        },
      });

      this.logger.log(`Job ${job.id} created for upload ${data.uploadId} by user ${user.sub}`);
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
        throw new BadRequestException('Job already exists for this upload');
      }

      this.logger.error(`Failed to create job: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new InternalServerErrorException('Failed to create job');
    }
  }

  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    errorMessage?: string,
    errorCode?: string,
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
          throw new NotFoundException(`Job with ID ${jobId} not found`);
        }

        // Allow if user owns the job or is admin/internal
        if (existingJob.userId !== user.sub && user.role !== 0 && user.role !== 1) {
          throw new ForbiddenException('Access denied to this job');
        }
      }

      const updateData: any = {
        status,
        ...(errorMessage && { errorMessage }),
        ...(errorCode && { errorCode }),
      };

      // Set completedAt if job is completed or failed
      if (status === JobStatus.success || status === JobStatus.failed) {
        updateData.completedAt = new Date();
      }

      const job = await this.prisma.job.update({
        where: { id: jobId },
        data: updateData,
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
        },
      });

      this.logger.log(`Job ${jobId} status updated to ${status}`);
      return job;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      this.logger.error(
        `Failed to update job status: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
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
        },
      });

      if (!job) {
        throw new NotFoundException(`Job for upload ${uploadId} not found`);
      }

      // Check if user has access (owns job, admin, or internal)
      if (job.userId !== user.sub && user.role !== 0 && user.role !== 1) {
        throw new ForbiddenException('Access denied to this job');
      }

      return job;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to fetch job: ${getErrorMessage(error)}`, getErrorStack(error));
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
        },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${jobId} not found`);
      }

      // Check if user has access (owns job, admin, or internal)
      if (job.userId !== user.sub && user.role !== 0 && user.role !== 1) {
        throw new ForbiddenException('Access denied to this job');
      }

      return job;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to fetch job: ${getErrorMessage(error)}`, getErrorStack(error));
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
        },
        orderBy: { startedAt: 'desc' },
      });

      return jobs;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch user jobs: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch user jobs');
    }
  }
}
