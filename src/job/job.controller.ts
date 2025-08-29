import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { JobService, CreateJobDto, JobResponseDto, UpdateJobStatusDto } from './job.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { InternalApiGuard } from 'src/auth/guards/internal-api.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { JobStatus, DocumentType } from '@prisma/client';

@Controller('jobs')
@ApiTags('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Create a new processing job for an upload' })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request or job already exists.' })
  @ApiResponse({ status: 403, description: 'Access denied to upload.' })
  @ApiResponse({ status: 404, description: 'Upload not found.' })
  create(@Body() dto: CreateJobDto, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.jobService.createJob(dto, user);
  }

  @Get('my-jobs')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get all jobs for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Return user jobs.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: Object.values(JobStatus) },
          type: { type: 'string', enum: Object.values(DocumentType) },
          uploadId: { type: 'string' },
          userId: { type: 'string' },
          startedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
          errorMessage: { type: 'string', nullable: true },
          errorCode: { type: 'string', nullable: true },
          textractJobId: { type: 'string', nullable: true },
          ocrJsonUrl: { type: 'string', nullable: true },
        },
      },
    },
  })
  getUserJobs(@CurrentUser() user: JwtPayload): Promise<JobResponseDto[]> {
    return this.jobService.getUserJobs(user);
  }

  @Get('upload/:uploadId')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get job by upload ID' })
  @ApiParam({ name: 'uploadId', description: 'Upload ID' })
  @ApiResponse({
    status: 200,
    description: 'Return job for upload.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to job.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  getJobByUploadId(
    @Param('uploadId') uploadId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<JobResponseDto> {
    return this.jobService.getJobByUploadId(uploadId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Return job.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to job.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  getJobById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<JobResponseDto> {
    return this.jobService.getJobById(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.INTERNAL) // Only admin and internal can update status
  @ApiOperation({ summary: 'Update job status (Admin/Internal only)' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiBody({
    description: 'Job status update data',
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: Object.values(JobStatus), description: 'New job status' },
        errorMessage: {
          type: 'string',
          nullable: true,
          description: 'Error message if job failed',
        },
        errorCode: { type: 'string', nullable: true, description: 'Error code if job failed' },
        textractJobId: {
          type: 'string',
          nullable: true,
          description: 'AWS Textract job ID for correlation',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Job status updated successfully.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid textractJobId or other validation errors',
  })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  updateJobStatus(
    @Param('id') id: string,
    @Body() body: UpdateJobStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<JobResponseDto> {
    return this.jobService.updateJobStatus(id, body, user);
  }

  // Internal API endpoints
  @Post('internal')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Create job for internal operations' })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully for internal use',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  createInternal(@Body() dto: CreateJobDto & { userId: string }): Promise<JobResponseDto> {
    // Create a mock user payload for internal operations
    const internalUser: JwtPayload = {
      sub: dto.userId,
      email: 'internal@system.com',
      role: 0, // Admin role for internal operations
    };

    return this.jobService.createJob(dto, internalUser);
  }

  @Patch('internal/:id/status')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Update job status for internal operations' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiBody({
    description: 'Job status update data',
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: Object.values(JobStatus), description: 'New job status' },
        errorMessage: {
          type: 'string',
          nullable: true,
          description: 'Error message if job failed',
        },
        errorCode: { type: 'string', nullable: true, description: 'Error code if job failed' },
        textractJobId: {
          type: 'string',
          nullable: true,
          description: 'AWS Textract job ID for correlation',
        },
        ocrJsonKey: {
          type: 'string',
          nullable: true,
          description: 'S3 key for OCR JSON results',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Job status updated successfully for internal use',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: Object.values(JobStatus) },
        type: { type: 'string', enum: Object.values(DocumentType) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        errorCode: { type: 'string', nullable: true },
        textractJobId: { type: 'string', nullable: true },
        ocrJsonUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid textractJobId or other validation errors',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  updateInternalJobStatus(
    @Param('id') id: string,
    @Body() body: UpdateJobStatusDto,
  ): Promise<JobResponseDto> {
    // Internal operations don't need user validation
    return this.jobService.updateJobStatus(id, body);
  }
}
