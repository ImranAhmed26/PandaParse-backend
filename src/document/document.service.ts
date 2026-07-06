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
import { DocumentDeletionPreviewDto } from './dto/document-deletion-preview.dto';
import { S3ObjectService } from '../aws/s3-object/s3-object.service';

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

export interface PaginatedDocumentsResponseDto {
  data: DocumentResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentOcrResultItemDto {
  id: string;
  name: string | null;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
  tax: number | null;
}

export interface DocumentOcrResultDto {
  id: string;
  status: string;
  summary: Record<string, any> | null;
  items: DocumentOcrResultItemDto[];
  reviewedAt: Date | null;
  approvedAt: Date | null;
}

/**
 * Bundled payload for the Document Editor: everything the editor needs in one call.
 * `fileUrl` is a short-lived presigned GET; `result` is the editable DB-backed data;
 * `parsed` is the raw Textract JSON (with bounding boxes) or null when unavailable.
 */
export interface DocumentOcrResponseDto {
  document: {
    id: string;
    fileName: string;
    type: DocumentType;
    status: DocumentStatus;
  };
  fileUrl: string | null;
  result: DocumentOcrResultDto | null;
  parsed: unknown | null;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private prisma: PrismaService,
    private readonly s3Object: S3ObjectService,
  ) {}

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
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedDocumentsResponseDto> {
    try {
      // Verify workspace access
      await this.validateWorkspaceAccess(workspaceId, user);

      const skip = (page - 1) * limit;
      const where = {
        workspace: {
          some: {
            workspaceId: workspaceId,
          },
        },
      };

      const [documents, total] = await Promise.all([
        this.prisma.document.findMany({
          where,
          skip,
          take: limit,
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
        }),
        this.prisma.document.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: documents,
        total,
        page,
        limit,
        totalPages,
      };
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

  /**
   * Bundled payload for the Document Editor: presigned file URL + editable result +
   * raw parsed Textract JSON. Resolves the document -> upload -> job -> result chain
   * server-side so the frontend never needs to know about uploadId/jobId plumbing.
   */
  async getDocumentOcr(documentId: string, user: JwtPayload): Promise<DocumentOcrResponseDto> {
    try {
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          fileName: true,
          type: true,
          status: true,
          userId: true,
          workspace: { select: { workspaceId: true } },
          upload: {
            select: {
              key: true,
              job: {
                select: {
                  result: {
                    select: {
                      id: true,
                      status: true,
                      jsonUrl: true,
                      summary: true,
                      reviewedAt: true,
                      approvedAt: true,
                      items: {
                        select: {
                          id: true,
                          name: true,
                          quantity: true,
                          unitPrice: true,
                          total: true,
                          tax: true,
                        },
                        orderBy: { createdAt: 'asc' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Access check: owner, admin, or a member of any workspace the document is in.
      const isOwnerOrAdmin = document.userId === user.sub || user.role === 0;
      if (!isOwnerOrAdmin) {
        let hasAccess = false;
        for (const ws of document.workspace) {
          try {
            await this.validateWorkspaceAccess(ws.workspaceId, user);
            hasAccess = true;
            break;
          } catch {
            // Try the next workspace association.
          }
        }
        if (!hasAccess) {
          throw new ForbiddenException('Access denied to this document');
        }
      }

      const key = document.upload?.key;
      const job = document.upload?.job;

      // DocumentResult.jsonUrl is the canonical location of the parsed-JSON S3 key
      // (written by createDocumentResult) — the single source of truth.
      const ocrKey = job?.result?.jsonUrl ?? null;

      const [fileUrl, parsed] = await Promise.all([
        key ? this.s3Object.getDownloadUrl(key) : Promise.resolve(null),
        ocrKey ? this.s3Object.getJson(ocrKey) : Promise.resolve(null),
      ]);

      const result: DocumentOcrResultDto | null = job?.result
        ? {
            id: job.result.id,
            status: job.result.status,
            summary: job.result.summary as Record<string, any> | null,
            items: job.result.items,
            reviewedAt: job.result.reviewedAt,
            approvedAt: job.result.approvedAt,
          }
        : null;

      return {
        document: {
          id: document.id,
          fileName: document.fileName,
          type: document.type,
          status: document.status,
        },
        fileUrl,
        result,
        parsed,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch document OCR payload: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch document OCR payload');
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

      this.logger.log(
        `Deleted ${deleteResult.count} documents from workspace ${workspaceId} by user ${user.sub}`,
      );
      return deleteResult.count;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to delete workspace documents: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to delete workspace documents');
    }
  }

  async deleteDocument(documentId: string, user: JwtPayload): Promise<void> {
    try {
      // First, get the document with all related data to check permissions and plan deletion
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          userId: true,
          uploadId: true,
          workspace: {
            select: {
              workspaceId: true,
            },
          },
          upload: {
            select: {
              id: true,
              job: {
                select: {
                  id: true,
                  result: {
                    select: {
                      id: true,
                      items: {
                        select: {
                          id: true,
                        },
                      },
                    },
                  },
                },
              },
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

      // Perform cascade deletion in correct order (deepest dependencies first)
      await this.performCascadeDelete(document);

      this.logger.log(`Document ${documentId} and all related records deleted by user ${user.sub}`);
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

  async previewDocumentDeletion(
    documentId: string,
    user: JwtPayload,
  ): Promise<DocumentDeletionPreviewDto> {
    try {
      // Get the document with all related data
      const document = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          fileName: true,
          userId: true,
          uploadId: true,
          workspace: {
            select: {
              workspaceId: true,
            },
          },
          upload: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              job: {
                select: {
                  id: true,
                  type: true,
                  status: true,
                  result: {
                    select: {
                      id: true,
                      jsonUrl: true,
                      csvUrl: true,
                      items: {
                        select: {
                          id: true,
                          name: true,
                          total: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!document) {
        throw new NotFoundException(`Document with ID ${documentId} not found`);
      }

      // Check permissions (same as delete)
      if (document.userId !== user.sub && user.role !== 0) {
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

      // Calculate what will be deleted
      const preview = {
        document: {
          id: document.id,
          fileName: document.fileName,
        },
        upload: document.upload
          ? {
              id: document.upload.id,
              fileName: document.upload.fileName,
              fileSize: document.upload.fileSize,
            }
          : null,
        job: document.upload?.job
          ? {
              id: document.upload.job.id,
              type: document.upload.job.type,
              status: document.upload.job.status,
            }
          : null,
        documentResult: document.upload?.job?.result
          ? {
              id: document.upload.job.result.id,
              jsonUrl: document.upload.job.result.jsonUrl,
              csvUrl: document.upload.job.result.csvUrl,
            }
          : null,
        invoiceItems: document.upload?.job?.result?.items || [],
        workspaceAssociations: document.workspace.length,
        totalRecordsToDelete: this.calculateTotalRecords(document),
      };

      return preview;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Failed to preview document deletion: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to preview document deletion');
    }
  }

  private calculateTotalRecords(document: {
    workspace: { workspaceId: string }[];
    upload?: {
      job?: {
        result?: {
          items: { id: string }[];
        } | null;
      } | null;
    } | null;
  }): number {
    let total = 1; // Document itself

    if (document.workspace.length > 0) {
      total += document.workspace.length; // WorkspaceDocument associations
    }

    if (document.upload) {
      total += 1; // Upload record

      if (document.upload.job) {
        total += 1; // Job record

        if (document.upload.job.result) {
          total += 1; // DocumentResult record
          total += document.upload.job.result.items.length; // InvoiceItems
        }
      }
    }

    return total;
  }

  private async performCascadeDelete(document: {
    id: string;
    upload?: {
      id: string;
      job?: {
        id: string;
        result?: {
          id: string;
          items: { id: string }[];
        } | null;
      } | null;
    } | null;
  }): Promise<void> {
    const { id: documentId, upload } = document;

    // Step 1: Delete InvoiceItems (deepest level)
    if (upload?.job?.result?.items) {
      const itemIds = upload.job.result.items.map(item => item.id);
      if (itemIds.length > 0) {
        await this.prisma.invoiceItem.deleteMany({
          where: { id: { in: itemIds } },
        });
        this.logger.log(`Deleted ${itemIds.length} invoice items for document ${documentId}`);
      }
    }

    // Step 2: Delete DocumentResult
    if (upload?.job?.result?.id) {
      await this.prisma.documentResult.delete({
        where: { id: upload.job.result.id },
      });
      this.logger.log(`Deleted document result for document ${documentId}`);
    }

    // Step 3: Delete Job
    if (upload?.job?.id) {
      await this.prisma.job.delete({
        where: { id: upload.job.id },
      });
      this.logger.log(`Deleted job for document ${documentId}`);
    }

    // Step 4: Delete WorkspaceDocument associations
    await this.prisma.workspaceDocument.deleteMany({
      where: { documentId },
    });

    // Step 5: Delete Document (this will set uploadId to null due to the relationship)
    await this.prisma.document.delete({
      where: { id: documentId },
    });

    // Step 6: Delete Upload (if it exists and is no longer referenced)
    if (upload?.id) {
      // Check if any other documents reference this upload
      const otherDocuments = await this.prisma.document.findMany({
        where: { uploadId: upload.id },
        select: { id: true },
      });

      if (otherDocuments.length === 0) {
        await this.prisma.upload.delete({
          where: { id: upload.id },
        });
        this.logger.log(`Deleted upload record for document ${documentId}`);
      } else {
        this.logger.log(
          `Upload record preserved - still referenced by ${otherDocuments.length} other documents`,
        );
      }
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
