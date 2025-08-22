import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  UseGuards,
  Param,
  Patch,
  Logger,
} from '@nestjs/common';
import { S3UploadUrlService } from '../s3-upload-url/s3-upload-url.service';
import { UploadRecordService } from './upload.service';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { InternalApiGuard } from 'src/auth/guards/internal-api.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto';
import { CreateUploadRecordDto } from './dto/create-upload-record.dto';
import { UpdateUploadStatusDto } from './dto/update-upload-status.dto';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { UploadCompletionResponseDto } from './dto/upload-completion-response.dto';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly s3UploadUrlService: S3UploadUrlService,
    private readonly uploadRecordService: UploadRecordService,
  ) {}

  // Legacy endpoint for backward compatibility
  @Get('generate-url')
  @ApiOperation({ summary: 'Generate a pre-signed URL for file upload (Legacy)' })
  @ApiQuery({ name: 'type', required: false, description: 'File type (e.g., pdf, png, jpg, jpeg)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a pre-signed URL and file key',
    schema: {
      example: {
        url: 'https://s3.eu-west-1.amazonaws.com/invoice-uploads/uploads/uuid.pdf?...',
        key: 'uploads/uuid.pdf',
      },
    },
  })
  async getUploadUrl(@Query('type') type: string) {
    return await this.s3UploadUrlService.generateUploadUrl(type || 'pdf');
  }

  // New enhanced endpoint for workspace-based uploads
  @Post('generate-url')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Generate presigned URL for document upload to S3' })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully',
    schema: {
      type: 'object',
      properties: {
        uploadUrl: { type: 'string', description: 'Presigned URL for S3 upload' },
        key: { type: 'string', description: 'S3 object key for the file' },
        expiresIn: { type: 'number', description: 'URL expiration time in seconds' },
        maxFileSize: { type: 'number', description: 'Maximum allowed file size in bytes' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or bad request' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async generatePresignedUrl(
    @Body() dto: GeneratePresignedUrlDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.s3UploadUrlService.generatePresignedUrl(dto, user.sub);
  }

  // Create upload record after S3 upload
  @Post('records')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Create upload record after S3 upload completion' })
  @ApiResponse({
    status: 201,
    description: 'Upload record created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        fileName: { type: 'string' },
        fileType: { type: 'string' },
        fileSize: { type: 'number', nullable: true },
        status: { type: 'string', enum: ['uploaded', 'processing', 'complete', 'failed'] },
        uploadedAt: { type: 'string', format: 'date-time' },
        userId: { type: 'string' },
        workspaceId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request or validation error' })
  @ApiResponse({ status: 403, description: 'Access denied to workspace' })
  async createUploadRecord(@Body() dto: CreateUploadRecordDto, @CurrentUser() user: JwtPayload) {
    return this.uploadRecordService.createUploadRecord(dto, user);
  }

  // Get uploads by workspace
  @Get('workspace/:workspaceId')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get all uploads in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Return uploads in the workspace',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          key: { type: 'string' },
          fileName: { type: 'string' },
          fileType: { type: 'string' },
          fileSize: { type: 'number', nullable: true },
          status: { type: 'string', enum: ['uploaded', 'processing', 'complete', 'failed'] },
          uploadedAt: { type: 'string', format: 'date-time' },
          userId: { type: 'string' },
          workspaceId: { type: 'string', nullable: true },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getUploadsByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.uploadRecordService.getUploadsByWorkspace(workspaceId, user);
  }

  // Get upload by ID
  @Get('records/:id')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get upload record by ID' })
  @ApiParam({ name: 'id', description: 'Upload ID' })
  @ApiResponse({
    status: 200,
    description: 'Return upload record',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        fileName: { type: 'string' },
        fileType: { type: 'string' },
        fileSize: { type: 'number', nullable: true },
        status: { type: 'string', enum: ['uploaded', 'processing', 'complete', 'failed'] },
        uploadedAt: { type: 'string', format: 'date-time' },
        userId: { type: 'string' },
        workspaceId: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to upload' })
  @ApiResponse({ status: 404, description: 'Upload not found' })
  async getUploadById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.uploadRecordService.getUploadById(id, user);
  }

  // Update upload status (Admin/Internal only)
  @Patch('records/:id/status')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.INTERNAL)
  @ApiOperation({ summary: 'Update upload status (Admin/Internal only)' })
  @ApiParam({ name: 'id', description: 'Upload ID' })
  @ApiResponse({
    status: 200,
    description: 'Upload status updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Upload not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateUploadStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUploadStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.uploadRecordService.updateUploadStatus(id, dto.status, user);
  }

  // Complete upload processing workflow
  @Post('complete')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({
    summary: 'Complete upload processing workflow',
    description:
      'Creates database records (Upload, Document, Job) and queues SQS processing message after S3 upload completion',
  })
  @ApiResponse({
    status: 201,
    description: 'Upload processing completed successfully',
    type: UploadCompletionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid input data or validation errors',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['fileName should not be empty', 's3Key must match the required format'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user lacks permissions for the specified workspace',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Access denied to workspace' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error - database or SQS operation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Failed to process upload completion' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async completeUpload(
    @Body() dto: CompleteUploadDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<UploadCompletionResponseDto> {
    const requestId = `req-${Date.now()}`;

    this.logger.log(`Upload completion request received`, {
      requestId,
      userId: user.sub,
      userEmail: user.email,
      workspaceId: dto.workspaceId,
      fileName: dto.fileName,
      fileType: dto.fileType,
      documentType: dto.documentType,
      s3Key: dto.s3Key,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await this.uploadRecordService.processUploadedFile(dto, user);

      this.logger.log(`Upload completion request completed successfully`, {
        requestId,
        userId: user.sub,
        uploadId: result.uploadId,
        documentId: result.documentId,
        jobId: result.jobId,
        sqsMessageId: result.sqsMessageId,
        status: result.status,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      this.logger.error(`Upload completion request failed`, {
        requestId,
        userId: user.sub,
        workspaceId: dto.workspaceId,
        fileName: dto.fileName,
        s3Key: dto.s3Key,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  }

  // Internal API endpoints for AWS operations
  @Post('internal/generate-url')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Generate presigned URL for internal AWS operations' })
  @ApiResponse({
    status: 201,
    description: 'Presigned URL generated successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  async generateInternalPresignedUrl(@Body() dto: GeneratePresignedUrlDto & { userId: string }) {
    return this.s3UploadUrlService.generatePresignedUrl(dto, dto.userId);
  }

  @Post('internal/records')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Create upload record for internal operations' })
  @ApiResponse({
    status: 201,
    description: 'Upload record created successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  async createInternalUploadRecord(@Body() dto: CreateUploadRecordDto & { userId: string }) {
    // Create a mock user payload for internal operations
    const internalUser: JwtPayload = {
      sub: dto.userId,
      email: 'internal@system.com',
      role: 0, // Admin role for internal operations
    };

    return this.uploadRecordService.createUploadRecord(dto, internalUser);
  }

  @Patch('internal/records/:id/status')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Update upload status for internal operations' })
  @ApiResponse({
    status: 200,
    description: 'Upload status updated successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  async updateInternalUploadStatus(@Param('id') id: string, @Body() dto: UpdateUploadStatusDto) {
    // Internal operations don't need user validation
    return this.uploadRecordService.updateUploadStatus(id, dto.status);
  }
}
