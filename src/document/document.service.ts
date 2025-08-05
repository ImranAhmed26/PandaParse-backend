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
import { DocumentType, DocumentStatus } from '@prisma/client';
import { OWNER_TYPES } from 'src/common/constants/enums';

export interface CreateDocumentDto {
  uploadId: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  workspaceId?: string;
}

export interface DocumentResponseDto {
  id: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  status: DocumentStatus;
  uploadId?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(private prisma: PrismaService) {}

  async createDocument(data: CreateDocumentDto, user: JwtPayload): Promise<DocumentResponseDto> {
    try {
      // Verify upload exists and user has access
      const upload = await this.prisma.upload.findUnique({
        where: { id: data.uploadId },
        select: {
          id: true,
          key: true,
          userId: true,
          workspaceId: true,
        },
      });

      if (!upload) {
        throw new NotFoundException('Upload not found');
      }

      // Verify user owns the upload or has admin access
      if (upload.userId !== user.sub && user.role !== 0) {
        throw new ForbiddenException('Access denied to this upload');
      }

      // If workspace is specified, verify it matches upload workspace
      if (data.workspaceId && data.workspaceId !== upload.workspaceId) {
        throw new BadRequestException('Workspace ID does not match upload workspace');
      }

      // Use upload's workspace if not specified
      const workspaceId = data.workspaceId || upload.workspaceId;

      // Create document record
      const document = await this.prisma.document.create({
        data: {
          fileName: data.fileName,
          documentUrl: data.documentUrl,
          type: data.type,
          status: DocumentStatus.UNPROCESSED,
          uploadId: data.uploadId,
          userId: user.sub,
        },
        select: {
          id: true,
          fileName: true,
          documentUrl: true,
          type: true,
          status: true,
          uploadId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // If workspace is specified, create workspace-document association
      if (workspaceId) {
        await this.prisma.workspaceDocument.create({
          data: {
            documentId: document.id,
            workspaceId: workspaceId,
          },
        });
      }

      this.logger.log(
        `Document ${document.id} created for upload ${data.uploadId} by user ${user.sub}`,
      );
      return document;
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
        throw new BadRequestException('Document already exists for this upload');
      }

      this.logger.error(
        `Failed to create document: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to create document');
    }
  }

  async getDocumentsByWorkspace(
    workspaceId: string,
    user: JwtPayload,
  ): Promise<DocumentResponseDto[]> {
    try {
      // Verify workspace access
      await this.validateWorkspaceAccess(workspaceId, user);

      const documents = await this.prisma.document.findMany({
        where: {
          workspace: {
            some: {
              workspaceId: workspaceId,
            },
          },
        },
        select: {
          id: true,
          fileName: true,
          documentUrl: true,
          type: true,
          status: true,
          uploadId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return documents;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch documents: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch documents');
    }
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    user?: JwtPayload,
  ): Promise<DocumentResponseDto> {
    try {
      // If user is provided, verify they have access
      if (user) {
        const existingDocument = await this.prisma.document.findUnique({
          where: { id: documentId },
          select: { userId: true },
        });

        if (!existingDocument) {
          throw new NotFoundException(`Document with ID ${documentId} not found`);
        }

        // Allow if user owns the document or is admin
        if (existingDocument.userId !== user.sub && user.role !== 0) {
          throw new ForbiddenException('Access denied to this document');
        }
      }

      const document = await this.prisma.document.update({
        where: { id: documentId },
        data: { status },
        select: {
          id: true,
          fileName: true,
          documentUrl: true,
          type: true,
          status: true,
          uploadId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Document ${documentId} status updated to ${status}`);
      return document;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      this.logger.error(
        `Failed to update document status: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update document status');
    }
  }

  async getDocumentById(documentId: string, user: JwtPayload): Promise<DocumentResponseDto> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          fileName: true,
          documentUrl: true,
          type: true,
          status: true,
          uploadId: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: {
              workspaceId: true,
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Check if user has access (owns document, admin, or has workspace access)
      if (document.userId !== user.sub && user.role !== 0) {
        // Check workspace access if document is in workspaces
        if (document.workspace.length > 0) {
          for (const ws of document.workspace) {
            try {
              await this.validateWorkspaceAccess(ws.workspaceId, user);
              // If any workspace access is valid, allow access
              break;
            } catch {
              // Continue checking other workspaces
            }
          }
          // If no workspace access found, deny
          if (document.workspace.length > 0) {
            throw new ForbiddenException('Access denied to this document');
          }
        } else {
          throw new ForbiddenException('Access denied to this document');
        }
      }

      // Remove workspace info from response
      const { workspace: _, ...documentResponse } = document;
      return documentResponse;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch document: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch document');
    }
  }

  async bulkDeleteDocuments(documentIds: string[], user: JwtPayload) {
    const results = {
      successful: [] as string[],
      failed: [] as { id: string; error: string }[],
      totalRequested: documentIds.length,
      totalSuccessful: 0,
      totalFailed: 0,
    };

    // Validate input
    if (!documentIds || documentIds.length === 0) {
      throw new BadRequestException('No document IDs provided');
    }

    if (documentIds.length > 100) {
      throw new BadRequestException('Cannot delete more than 100 documents at once');
    }

    // Process each document deletion
    for (const documentId of documentIds) {
      try {
        await this.deleteDocument(documentId, user);
        results.successful.push(documentId);
        results.totalSuccessful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed.push({
          id: documentId,
          error: errorMessage,
        });
        results.totalFailed++;

        // Log the error but continue with other deletions
        this.logger.warn(`Failed to delete document ${documentId}: ${errorMessage}`);
      }
    }

    this.logger.log(
      `Bulk delete completed for user ${user.sub}: ${results.totalSuccessful} successful, ${results.totalFailed} failed`,
    );

    return results;
  }

  async deleteWorkspaceDocuments(workspaceId: string, user: JwtPayload): Promise<number> {
    try {
      // Verify workspace access first
      await this.validateWorkspaceAccess(workspaceId, user);

      // Get all documents in the workspace
      const documents = await this.prisma.document.findMany({
        where: {
          workspace: {
            some: {
              workspaceId: workspaceId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (documents.length === 0) {
        return 0;
      }

      const documentIds = documents.map(doc => doc.id);

      // Delete workspace associations first
      await this.prisma.workspaceDocument.deleteMany({
        where: {
          workspaceId: workspaceId,
        },
      });

      // Delete all documents
      const deleteResult = await this.prisma.document.deleteMany({
        where: {
          id: {
            in: documentIds,
          },
        },
      });

      this.logger.log(`Deleted ${deleteResult.count} documents from workspace ${workspaceId} by user ${user.sub}`);
      return deleteResult.count;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to delete workspace documents: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new InternalServerErrorException('Failed to delete workspace documents');
    }
  }

  async deleteDocument(documentId: string, user: JwtPayload): Promise<void> {
    try {
      // First, get the document to check permissions
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          userId: true,
          workspace: {
            select: {
              workspaceId: true,
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Check if user has access (owns document, admin, or has workspace access)
      if (document.userId !== user.sub && user.role !== 0) {
        // Check workspace access if document is in workspaces
        if (document.workspace.length > 0) {
          let hasWorkspaceAccess = false;
          for (const ws of document.workspace) {
            try {
              await this.validateWorkspaceAccess(ws.workspaceId, user);
              hasWorkspaceAccess = true;
              break;
            } catch {
              // Continue checking other workspaces
            }
          }
          if (!hasWorkspaceAccess) {
            throw new ForbiddenException('Access denied to this document');
          }
        } else {
          throw new ForbiddenException('Access denied to this document');
        }
      }

      // Delete workspace associations first (due to foreign key constraints)
      await this.prisma.workspaceDocument.deleteMany({
        where: { documentId },
      });

      // Delete the document
      await this.prisma.document.delete({
        where: { id: documentId },
      });

      this.logger.log(`Document ${documentId} deleted by user ${user.sub}`);
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      this.logger.error(
        `Failed to delete document: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to delete document');
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
