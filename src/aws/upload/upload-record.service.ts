import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { UploadStatus } from '@prisma/client';
import { OWNER_TYPES } from 'src/common/constants/enums';

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

  constructor(private prisma: PrismaService) {}

  async createUploadRecord(
    data: CreateUploadRecordDto,
    user: JwtPayload,
  ): Promise<UploadRecordResponseDto> {
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

      this.logger.log(`Upload record ${uploadRecord.id} created for user ${user.sub}`);
      return uploadRecord;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2002') {
        throw new BadRequestException('Upload with this key already exists');
      }

      this.logger.error(
        `Failed to create upload record: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
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

  private async validateWorkspaceAccess(workspaceId: string, user: JwtPayload): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerId: true,
        ownerType: true,
      },
    });

    if (!workspace) {
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
      throw new ForbiddenException('User not found');
    }

    // Check workspace access
    const hasAccess =
      userRecord.role === 0 || // ADMIN
      (workspace.ownerType === OWNER_TYPES.USER && workspace.ownerId === user.sub) || // User-owned
      (workspace.ownerType === OWNER_TYPES.COMPANY && userRecord.companyId === workspace.ownerId); // Company-owned

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }
}
