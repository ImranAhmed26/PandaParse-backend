import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { OWNER_TYPES } from 'src/common/constants/enums';

export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxFileSize: number;
}

@Injectable()
export class S3UploadUrlService {
  private readonly logger = new Logger(S3UploadUrlService.name);
  private s3Client: S3Client;
  private bucket: string;
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly expiresIn = 600; // 10 minutes

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION') as string,
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') as string,
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') as string,
      },
    });
    const bucketName = this.configService.get<string>('S3_BUCKET_NAME');
    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME is not defined');
    }
    this.bucket = bucketName;
  }

  // Legacy method for backward compatibility
  async generateUploadUrl(fileType: string): Promise<{ url: string; key: string }> {
    const key = `invoice-uploads/${uuidv4()}.${fileType}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: this.mapMimeType(fileType),
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    return { url, key };
  }

  // New enhanced method for workspace-based uploads
  async generatePresignedUrl(
    request: PresignedUrlRequest,
    userId: string,
  ): Promise<PresignedUrlResponse> {
    // Validate workspace access if workspaceId is provided
    if (request.workspaceId) {
      await this.validateWorkspaceAccess(request.workspaceId, userId);
    }

    // Validate file type
    if (!this.validateFileType(request.fileType)) {
      throw new BadRequestException(
        `File type '${request.fileType}' not allowed. Supported types: ${this.getAllowedFileTypes().join(', ')}`,
      );
    }

    // Validate file size
    if (request.fileSize && request.fileSize > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.formatFileSize(this.maxFileSize)}`,
      );
    }

    // Generate organized S3 key
    const key = this.generateS3Key(request.fileName, userId, request.workspaceId);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: request.fileType,
      Metadata: {
        userId,
        originalFileName: request.fileName,
        uploadedAt: new Date().toISOString(),
        ...(request.workspaceId && { workspaceId: request.workspaceId }),
        ...(request.fileSize && { fileSize: request.fileSize.toString() }),
      },
    });

    try {
      const uploadUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: this.expiresIn,
      });

      this.logger.log(`Generated presigned URL for user ${userId}, file: ${request.fileName}`);

      return {
        uploadUrl,
        key,
        expiresIn: this.expiresIn,
        maxFileSize: this.maxFileSize,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to generate presigned URL: ${errorMessage}`);
      throw new BadRequestException('Failed to generate upload URL');
    }
  }

  generateS3Key(fileName: string, userId: string, workspaceId?: string): string {
    // Sanitize filename
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileExtension = sanitizedFileName.split('.').pop();
    const baseFileName = sanitizedFileName.replace(`.${fileExtension}`, '');
    const uniqueId = uuidv4();

    // Organize files by user and optionally by workspace
    const keyPrefix = workspaceId
      ? `documents/${userId}/${workspaceId}`
      : `documents/${userId}/personal`;

    return `${keyPrefix}/${baseFileName}-${uniqueId}.${fileExtension}`;
  }

  validateFileType(mimeType: string): boolean {
    return this.getAllowedFileTypes().includes(mimeType);
  }

  private getAllowedFileTypes(): string[] {
    return [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // Legacy method for backward compatibility
  private mapMimeType(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
    };
    return map[ext.toLowerCase()] ?? 'application/octet-stream';
  }

  private async validateWorkspaceAccess(workspaceId: string, userId: string): Promise<void> {
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
      where: { id: userId },
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
      (workspace.ownerType === OWNER_TYPES.USER && workspace.ownerId === userId) || // User-owned
      (workspace.ownerType === OWNER_TYPES.COMPANY && userRecord.companyId === workspace.ownerId); // Company-owned

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }
}
