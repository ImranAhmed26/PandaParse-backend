import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getErrorMessage,
  getErrorStack,
  getPrismaErrorCode,
  getPrismaErrorMessage,
  createStructuredError,
  isRetryableError,
} from 'src/common/types/error.types';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { UploadStatus, DocumentStatus, JobStatus } from '@prisma/client';
import { OWNER_TYPES } from 'src/common/constants/enums';
import { DocumentService } from '../../document/document.service';
import { JobService } from '../../job/job.service';
import { AwsSqsService } from '../sqs/aws-sqs.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { UploadCompletionResponseDto } from './dto/upload-completion-response.dto';

export interface CreateUploadRecordDto {
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

export interface UploadRecordResponseDto {
  id: string;
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  status: UploadStatus;
  uploadedAt: Date;
  userId: string;
  workspaceId?: string | null;
}

@Injectable()
export class UploadRecordService {
  private readonly logger = new Logger(UploadRecordService.name);

  constructor(
    private prisma: PrismaService,
    private documentService: DocumentService,
    private jobService: JobService,
    private awsSqsService: AwsSqsService,
  ) {}

  async createUploadRecord(
    data: CreateUploadRecordDto,
    user: JwtPayload,
  ): Promise<UploadRecordResponseDto> {
    this.logger.debug(`Creating upload record`, {
      userId: user.sub,
      workspaceId: data.workspaceId,
      fileName: data.fileName,
      fileType: data.fileType,
      s3Key: data.key,
      timestamp: new Date().toISOString(),
    });

    try {
      // If workspace is specified, verify user has access
      if (data.workspaceId) {
        await this.validateWorkspaceAccess(data.workspaceId, user);
      }

      const uploadRecord = await this.prisma.upload.create({
        data: {
          key: data.key,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          status: UploadStatus.uploaded,
          userId: user.sub,
          workspaceId: data.workspaceId,
        },
        select: {
          id: true,
          key: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          uploadedAt: true,
          userId: true,
          workspaceId: true,
        },
      });

      this.logger.log(`Upload record created successfully`, {
        uploadId: uploadRecord.id,
        userId: user.sub,
        workspaceId: data.workspaceId,
        fileName: data.fileName,
        s3Key: data.key,
        timestamp: new Date().toISOString(),
      });

      return uploadRecord;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      const errorMessage = getPrismaErrorMessage(error);

      const structuredError = createStructuredError(
        errorCode || 'UPLOAD_RECORD_CREATION_FAILED',
        errorMessage,
        {
          s3Key: data.key,
          fileName: data.fileName,
          fileType: data.fileType,
          originalError: getErrorMessage(error),
        },
        'createUploadRecord',
        user.sub,
        data.workspaceId,
      );

      this.logger.error(`Failed to create upload record`, {
        ...structuredError,
        stack: getErrorStack(error),
      });

      if (errorCode === 'P2002') {
        throw new BadRequestException('Upload with this key already exists');
      }

      throw new InternalServerErrorException('Failed to create upload record');
    }
  }

  async updateUploadStatus(
    uploadId: string,
    status: UploadStatus,
    user?: JwtPayload,
  ): Promise<UploadRecordResponseDto> {
    try {
      // If user is provided, verify they own the upload or have admin access
      if (user) {
        const existingUpload = await this.prisma.upload.findUnique({
          where: { id: uploadId },
          select: { userId: true },
        });

        if (!existingUpload) {
          throw new NotFoundException(`Upload with ID ${uploadId} not found`);
        }

        // Allow if user owns the upload or is admin
        if (existingUpload.userId !== user.sub && user.role !== 0) {
          throw new ForbiddenException('Access denied to this upload');
        }
      }

      const uploadRecord = await this.prisma.upload.update({
        where: { id: uploadId },
        data: { status },
        select: {
          id: true,
          key: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          uploadedAt: true,
          userId: true,
          workspaceId: true,
        },
      });

      this.logger.log(`Upload ${uploadId} status updated to ${status}`);
      return uploadRecord;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Upload with ID ${uploadId} not found`);
      }

      this.logger.error(
        `Failed to update upload status: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update upload status');
    }
  }

  async getUploadsByWorkspace(
    workspaceId: string,
    user: JwtPayload,
  ): Promise<UploadRecordResponseDto[]> {
    try {
      // Verify workspace access
      await this.validateWorkspaceAccess(workspaceId, user);

      const uploads = await this.prisma.upload.findMany({
        where: { workspaceId },
        select: {
          id: true,
          key: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          uploadedAt: true,
          userId: true,
          workspaceId: true,
        },
        orderBy: { uploadedAt: 'desc' },
      });

      return uploads;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch uploads: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new InternalServerErrorException('Failed to fetch uploads');
    }
  }

  async getUploadById(uploadId: string, user: JwtPayload): Promise<UploadRecordResponseDto> {
    try {
      const upload = await this.prisma.upload.findUnique({
        where: { id: uploadId },
        select: {
          id: true,
          key: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          status: true,
          uploadedAt: true,
          userId: true,
          workspaceId: true,
        },
      });

      if (!upload) {
        throw new NotFoundException(`Upload with ID ${uploadId} not found`);
      }

      // Check if user has access (owns upload, admin, or has workspace access)
      if (upload.userId !== user.sub && user.role !== 0) {
        if (upload.workspaceId) {
          await this.validateWorkspaceAccess(upload.workspaceId, user);
        } else {
          throw new ForbiddenException('Access denied to this upload');
        }
      }

      return upload;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Failed to fetch upload: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new InternalServerErrorException('Failed to fetch upload');
    }
  }

  async processUploadedFile(
    data: CompleteUploadDto,
    user: JwtPayload,
  ): Promise<UploadCompletionResponseDto> {
    const operationId = `upload-completion-${Date.now()}`;
    const startTime = Date.now();

    this.logger.log(`Starting upload completion processing`, {
      operationId,
      userId: user.sub,
      workspaceId: data.workspaceId,
      fileName: data.fileName,
      fileType: data.fileType,
      documentType: data.documentType,
      s3Key: data.s3Key,
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 1: Validate user ID matches JWT payload
      if (data.userId !== user.sub) {
        const error = createStructuredError(
          'USER_MISMATCH',
          'User ID does not match authenticated user',
          { providedUserId: data.userId, authenticatedUserId: user.sub },
          'processUploadedFile',
          user.sub,
          data.workspaceId,
        );
        this.logger.warn(`User ID validation failed`, error);
        throw new ForbiddenException(getErrorMessage(error));
      }

      // Step 2: Validate workspace access if specified
      if (data.workspaceId) {
        try {
          await this.validateWorkspaceAccess(data.workspaceId, user);
          this.logger.debug(`Workspace access validated`, {
            operationId,
            userId: user.sub,
            workspaceId: data.workspaceId,
          });
        } catch (workspaceError) {
          const error = createStructuredError(
            'WORKSPACE_ACCESS_DENIED',
            'Failed workspace access validation',
            { workspaceId: data.workspaceId, originalError: getErrorMessage(workspaceError) },
            'processUploadedFile',
            user.sub,
            data.workspaceId,
          );
          this.logger.error(`Workspace access validation failed`, error);
          throw workspaceError;
        }
      }

      // Step 3: Execute database transaction with comprehensive error handling
      let transactionResult: {
        upload: {
          id: string;
          key: string;
          fileName: string;
          userId: string;
          workspaceId: string | null;
        };
        document: {
          id: string;
          fileName: string;
          documentUrl: string;
          type: any;
          status: DocumentStatus;
          uploadId: string | null;
          userId: string;
        };
        job: {
          id: string;
          type: any;
          status: JobStatus;
          uploadId: string;
          userId: string;
          startedAt: Date | null;
        };
      };
      try {
        transactionResult = await this.prisma.$transaction(
          async tx => {
            this.logger.debug(`Starting database transaction`, {
              operationId,
              userId: user.sub,
              workspaceId: data.workspaceId,
            });

            // Create Upload record
            const upload = await tx.upload.create({
              data: {
                key: data.s3Key,
                fileName: data.fileName,
                fileType: data.fileType,
                fileSize: data.fileSize,
                status: UploadStatus.uploaded,
                userId: data.userId,
                workspaceId: data.workspaceId,
              },
              select: {
                id: true,
                key: true,
                fileName: true,
                userId: true,
                workspaceId: true,
              },
            });

            this.logger.debug(`Upload record created`, {
              operationId,
              uploadId: upload.id,
              s3Key: data.s3Key,
            });

            // Create Document record
            const documentUrl = `s3://${process.env.S3_BUCKET_NAME}/${data.s3Key}`;
            const document = await tx.document.create({
              data: {
                fileName: data.fileName,
                documentUrl: documentUrl,
                type: data.documentType,
                status: DocumentStatus.UNPROCESSED,
                uploadId: upload.id,
                userId: data.userId,
              },
              select: {
                id: true,
                fileName: true,
                documentUrl: true,
                type: true,
                status: true,
                uploadId: true,
                userId: true,
              },
            });

            this.logger.debug(`Document record created`, {
              operationId,
              documentId: document.id,
              documentUrl,
              documentType: data.documentType,
            });

            // Create workspace-document association if workspace is specified
            if (data.workspaceId) {
              await tx.workspaceDocument.create({
                data: {
                  documentId: document.id,
                  workspaceId: data.workspaceId,
                },
              });

              this.logger.debug(`Workspace-document association created`, {
                operationId,
                documentId: document.id,
                workspaceId: data.workspaceId,
              });
            }

            // Create Job record
            const job = await tx.job.create({
              data: {
                type: data.documentType,
                status: JobStatus.pending,
                uploadId: upload.id,
                userId: data.userId,
              },
              select: {
                id: true,
                type: true,
                status: true,
                uploadId: true,
                userId: true,
                startedAt: true,
              },
            });

            this.logger.debug(`Job record created`, {
              operationId,
              jobId: job.id,
              jobType: data.documentType,
              jobStatus: JobStatus.pending,
            });

            return { upload, document, job };
          },
          {
            timeout: 30000, // 30 second timeout
            maxWait: 5000, // 5 second max wait for transaction to start
          },
        );

        this.logger.log(`Database transaction completed successfully`, {
          operationId,
          uploadId: transactionResult.upload.id,
          documentId: transactionResult.document.id,
          jobId: transactionResult.job.id,
          transactionDuration: `${Date.now() - startTime}ms`,
        });
      } catch (transactionError) {
        const errorCode = getPrismaErrorCode(transactionError);
        const errorMessage = getPrismaErrorMessage(transactionError);
        const isRetryable = isRetryableError(transactionError);

        const error = createStructuredError(
          errorCode || 'DATABASE_TRANSACTION_FAILED',
          errorMessage,
          {
            originalError: getErrorMessage(transactionError),
            isRetryable,
            s3Key: data.s3Key,
            fileName: data.fileName,
            documentType: data.documentType,
          },
          'processUploadedFile',
          user.sub,
          data.workspaceId,
        );

        this.logger.error(`Database transaction failed`, {
          ...error,
          stack: getErrorStack(transactionError),
          transactionDuration: `${Date.now() - startTime}ms`,
        });

        // Handle specific error cases
        if (errorCode === 'P2002') {
          throw new BadRequestException('Upload with this S3 key already exists');
        }

        if (isRetryable) {
          throw new InternalServerErrorException(
            'Database operation failed temporarily, please retry',
          );
        }

        throw new InternalServerErrorException('Failed to create database records for upload');
      }

      // Step 4: Send SQS message with enhanced error handling and fallback
      let sqsMessageId = '';
      let sqsSuccess = false;

      try {
        const processingMessageData = {
          jobId: transactionResult.job.id,
          uploadId: transactionResult.upload.id,
          documentId: transactionResult.document.id,
          s3Key: data.s3Key,
          documentType: data.documentType,
          userId: data.userId,
          workspaceId: data.workspaceId,
          fileName: data.fileName,
          fileType: data.fileType,
          timestamp: new Date().toISOString(),
        };

        sqsMessageId = await this.awsSqsService.sendProcessingMessage(processingMessageData);
        sqsSuccess = true;

        this.logger.log(`SQS processing message sent successfully`, {
          operationId,
          jobId: transactionResult.job.id,
          uploadId: transactionResult.upload.id,
          documentId: transactionResult.document.id,
          sqsMessageId,
        });
      } catch (sqsError) {
        const error = createStructuredError(
          'SQS_SEND_FAILED',
          'Failed to send SQS processing message',
          {
            jobId: transactionResult.job.id,
            uploadId: transactionResult.upload.id,
            documentId: transactionResult.document.id,
            originalError: getErrorMessage(sqsError),
            isRetryable: isRetryableError(sqsError),
          },
          'processUploadedFile',
          user.sub,
          data.workspaceId,
        );

        this.logger.error(`SQS message sending failed`, {
          ...error,
          stack: getErrorStack(sqsError),
        });

        // Implement fallback behavior: mark job as failed but continue
        try {
          await this.prisma.job.update({
            where: { id: transactionResult.job.id },
            data: {
              status: JobStatus.failed,
              errorMessage: 'Failed to queue processing task - SQS unavailable',
              errorCode: 'SQS_SEND_FAILED',
            },
          });

          this.logger.warn(`Job marked as failed due to SQS error`, {
            operationId,
            jobId: transactionResult.job.id,
            errorCode: 'SQS_SEND_FAILED',
          });
        } catch (updateError) {
          const updateErrorDetails = createStructuredError(
            'JOB_STATUS_UPDATE_FAILED',
            'Failed to update job status after SQS error',
            {
              jobId: transactionResult.job.id,
              originalSqsError: getErrorMessage(sqsError),
              updateError: getErrorMessage(updateError),
            },
            'processUploadedFile',
            user.sub,
            data.workspaceId,
          );

          this.logger.error(`Failed to update job status after SQS error`, {
            ...updateErrorDetails,
            stack: getErrorStack(updateError),
          });
        }

        // Set fallback message ID
        sqsMessageId = 'FAILED_TO_SEND';
      }

      // Step 5: Log successful completion and return response
      const totalDuration = Date.now() - startTime;

      this.logger.log(`Upload completion processing finished`, {
        operationId,
        uploadId: transactionResult.upload.id,
        documentId: transactionResult.document.id,
        jobId: transactionResult.job.id,
        sqsMessageId,
        sqsSuccess,
        totalDuration: `${totalDuration}ms`,
        status: 'success',
        timestamp: new Date().toISOString(),
      });

      return {
        uploadId: transactionResult.upload.id,
        documentId: transactionResult.document.id,
        jobId: transactionResult.job.id,
        sqsMessageId: sqsMessageId,
        status: 'success',
      };
    } catch (error: unknown) {
      const totalDuration = Date.now() - startTime;

      // Re-throw known exceptions without modification
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        this.logger.warn(`Upload completion processing failed with known exception`, {
          operationId,
          errorType: error.constructor.name,
          errorMessage: error.message,
          totalDuration: `${totalDuration}ms`,
          userId: user.sub,
          workspaceId: data.workspaceId,
          s3Key: data.s3Key,
        });
        throw error;
      }

      // Handle unexpected errors
      const structuredError = createStructuredError(
        'UPLOAD_COMPLETION_FAILED',
        'Unexpected error during upload completion processing',
        {
          originalError: getErrorMessage(error),
          isRetryable: isRetryableError(error),
          s3Key: data.s3Key,
          fileName: data.fileName,
          documentType: data.documentType,
        },
        'processUploadedFile',
        user.sub,
        data.workspaceId,
      );

      this.logger.error(`Upload completion processing failed with unexpected error`, {
        ...structuredError,
        operationId,
        totalDuration: `${totalDuration}ms`,
        stack: getErrorStack(error),
      });

      throw new InternalServerErrorException('Failed to process uploaded file');
    }
  }

  private async validateWorkspaceAccess(workspaceId: string, user: JwtPayload): Promise<void> {
    this.logger.debug(`Validating workspace access`, {
      workspaceId,
      userId: user.sub,
      userRole: user.role,
    });

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          ownerId: true,
          ownerType: true,
        },
      });

      if (!workspace) {
        const error = createStructuredError(
          'WORKSPACE_NOT_FOUND',
          'Workspace not found',
          { workspaceId },
          'validateWorkspaceAccess',
          user.sub,
          workspaceId,
        );
        this.logger.warn(`Workspace not found during access validation`, error);
        throw new NotFoundException('Workspace not found');
      }

      // Get user details
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          id: true,
          companyId: true,
          role: true,
        },
      });

      if (!userRecord) {
        const error = createStructuredError(
          'USER_NOT_FOUND',
          'User not found in database',
          { userId: user.sub },
          'validateWorkspaceAccess',
          user.sub,
          workspaceId,
        );
        this.logger.error(`User not found during workspace access validation`, error);
        throw new ForbiddenException('User not found');
      }

      // Check workspace access
      const hasAccess =
        userRecord.role === 0 || // ADMIN
        (workspace.ownerType === OWNER_TYPES.USER && workspace.ownerId === user.sub) || // User-owned
        (workspace.ownerType === OWNER_TYPES.COMPANY && userRecord.companyId === workspace.ownerId); // Company-owned

      if (!hasAccess) {
        const error = createStructuredError(
          'WORKSPACE_ACCESS_DENIED',
          'Access denied to workspace',
          {
            workspaceId,
            workspaceOwnerId: workspace.ownerId,
            workspaceOwnerType: workspace.ownerType,
            userRole: userRecord.role,
            userCompanyId: userRecord.companyId,
          },
          'validateWorkspaceAccess',
          user.sub,
          workspaceId,
        );
        this.logger.warn(`Workspace access denied`, error);
        throw new ForbiddenException('Access denied to this workspace');
      }

      this.logger.debug(`Workspace access validated successfully`, {
        workspaceId,
        userId: user.sub,
        accessType:
          userRecord.role === 0
            ? 'admin'
            : workspace.ownerType === OWNER_TYPES.USER
              ? 'user-owned'
              : 'company-owned',
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const structuredError = createStructuredError(
        'WORKSPACE_ACCESS_VALIDATION_FAILED',
        'Failed to validate workspace access',
        {
          workspaceId,
          originalError: getErrorMessage(error),
        },
        'validateWorkspaceAccess',
        user.sub,
        workspaceId,
      );

      this.logger.error(`Workspace access validation failed`, {
        ...structuredError,
        stack: getErrorStack(error),
      });

      throw new InternalServerErrorException('Failed to validate workspace access');
    }
  }
}
