import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentResultDto } from './dto/create-document-result.dto';
import { UpdateDocumentResultDto } from './dto/update-document-result.dto';
import { DocumentResultResponseDto } from './dto/document-result-response.dto';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { DocumentStatus } from '@prisma/client';

@Injectable()
export class DocumentResultService {
  private readonly logger = new Logger(DocumentResultService.name);

  constructor(private prisma: PrismaService) {}

  async createDocumentResult(
    data: CreateDocumentResultDto,
  ): Promise<DocumentResultResponseDto | null> {
    const operationId = `create-result-${Date.now()}`;

    this.logger.log(`Processing document result for job ${data.jobId}`, {
      operationId,
      jobId: data.jobId,
      documentProcessed: data.documentProcessed,
      hasJsonUrl: !!data.jsonUrl,
      hasCsvUrl: !!data.csvUrl,
      hasSummary: !!data.summary,
      itemCount: data.items?.length || 0,
    });

    try {
      // Verify job exists and get associated document
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        select: {
          id: true,
          status: true,
          result: {
            select: { id: true },
          },
          upload: {
            select: {
              id: true,
              document: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${data.jobId} not found`);
      }

      // Get the document associated with this job
      const document = job.upload?.document;
      if (!document) {
        throw new NotFoundException(`No document found for job ${data.jobId}`);
      }

      // Handle based on documentProcessed flag
      if (!data.documentProcessed) {
        // Document processing failed - update document status to FLAGGED
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.FLAGGED },
        });

        this.logger.log(
          `Document ${document.id} status updated to FLAGGED (job ${data.jobId} failed processing)`,
          {
            operationId,
            documentId: document.id,
            jobId: data.jobId,
          },
        );

        // Return null to indicate no result was created
        return null;
      }

      // Document processed successfully - check if result already exists
      if (job.result) {
        throw new ConflictException(
          `Job ${data.jobId} already has a document result (ID: ${job.result.id})`,
        );
      }

      // Create DocumentResult, InvoiceItems, and update Document status in a transaction
      const result = await this.prisma.$transaction(async tx => {
        // Create DocumentResult
        const documentResult = await tx.documentResult.create({
          data: {
            jobId: data.jobId,
            jsonUrl: data.jsonUrl,
            csvUrl: data.csvUrl,
            summary: data.summary ? (data.summary as any) : null,
          },
          select: {
            id: true,
            jobId: true,
            jsonUrl: true,
            csvUrl: true,
            createdAt: true,
            summary: true,
            status: true,
            reviewedAt: true,
            approvedAt: true,
            approvedById: true,
          },
        });

        this.logger.debug(`DocumentResult created`, {
          operationId,
          resultId: documentResult.id,
          jobId: data.jobId,
        });

        // Create InvoiceItems if provided
        let items: any[] = [];
        if (data.items && data.items.length > 0) {
          const itemsData = data.items.map(item => ({
            resultId: documentResult.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            tax: item.tax,
          }));

          await tx.invoiceItem.createMany({
            data: itemsData,
          });

          // Fetch created items
          items = await tx.invoiceItem.findMany({
            where: { resultId: documentResult.id },
            select: {
              id: true,
              resultId: true,
              name: true,
              quantity: true,
              unitPrice: true,
              total: true,
              tax: true,
              createdAt: true,
            },
          });

          this.logger.debug(`Created ${items.length} invoice items`, {
            operationId,
            resultId: documentResult.id,
            itemCount: items.length,
          });
        }

        // Update document status to PROCESSED
        await tx.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.PROCESSED },
        });

        this.logger.debug(`Document ${document.id} status updated to PROCESSED`, {
          operationId,
          documentId: document.id,
          jobId: data.jobId,
        });

        return {
          ...documentResult,
          items,
          summary: documentResult.summary as Record<string, any> | null,
        };
      });

      this.logger.log(`Document result created successfully`, {
        operationId,
        resultId: result.id,
        jobId: data.jobId,
        itemCount: result.items.length,
      });

      return result as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);

      if (errorCode === 'P2002') {
        throw new ConflictException(`Document result already exists for job ${data.jobId}`);
      }

      if (errorCode === 'P2003') {
        throw new BadRequestException(`Invalid job ID: ${data.jobId}`);
      }

      this.logger.error(
        `Failed to create document result for job ${data.jobId}: ${getErrorMessage(error)}`,
        {
          operationId,
          jobId: data.jobId,
          errorCode,
          stack: getErrorStack(error),
        },
      );

      throw new InternalServerErrorException('Failed to create document result');
    }
  }

  async getDocumentResultByJobId(jobId: string): Promise<DocumentResultResponseDto> {
    try {
      const result = await this.prisma.documentResult.findUnique({
        where: { jobId },
        select: {
          id: true,
          jobId: true,
          jsonUrl: true,
          csvUrl: true,
          createdAt: true,
          summary: true,
          status: true,
          reviewedAt: true,
          approvedAt: true,
          approvedById: true,
          items: {
            select: {
              id: true,
              resultId: true,
              name: true,
              quantity: true,
              unitPrice: true,
              total: true,
              tax: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!result) {
        throw new NotFoundException(`Document result for job ${jobId} not found`);
      }

      return {
        ...result,
        summary: result.summary as Record<string, any> | null,
      } as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch document result for job ${jobId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch document result');
    }
  }

  async getDocumentResultById(id: string): Promise<DocumentResultResponseDto> {
    try {
      const result = await this.prisma.documentResult.findUnique({
        where: { id },
        select: {
          id: true,
          jobId: true,
          jsonUrl: true,
          csvUrl: true,
          createdAt: true,
          summary: true,
          status: true,
          reviewedAt: true,
          approvedAt: true,
          approvedById: true,
          items: {
            select: {
              id: true,
              resultId: true,
              name: true,
              quantity: true,
              unitPrice: true,
              total: true,
              tax: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!result) {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      return {
        ...result,
        summary: result.summary as Record<string, any> | null,
      } as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch document result ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch document result');
    }
  }

  /**
   * Edit a document result from the Document Editor. Updates `summary` and/or fully
   * replaces line `items` in a single transaction. Only provided fields are changed.
   */
  async updateDocumentResult(
    id: string,
    dto: UpdateDocumentResultDto,
  ): Promise<DocumentResultResponseDto> {
    try {
      const existing = await this.prisma.documentResult.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      const result = await this.prisma.$transaction(async tx => {
        if (dto.summary !== undefined) {
          await tx.documentResult.update({
            where: { id },
            data: { summary: dto.summary as any },
          });
        }

        if (dto.items !== undefined) {
          // Replace existing line items with the corrected set.
          await tx.invoiceItem.deleteMany({ where: { resultId: id } });
          if (dto.items.length > 0) {
            await tx.invoiceItem.createMany({
              data: dto.items.map(item => ({
                resultId: id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total,
                tax: item.tax,
              })),
            });
          }
        }

        return tx.documentResult.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            jobId: true,
            jsonUrl: true,
            csvUrl: true,
            createdAt: true,
            summary: true,
            status: true,
            reviewedAt: true,
            approvedAt: true,
            approvedById: true,
            items: {
              select: {
                id: true,
                resultId: true,
                name: true,
                quantity: true,
                unitPrice: true,
                total: true,
                tax: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        });
      });

      this.logger.log(`Document result ${id} updated (summary/items edited)`);

      return {
        ...result,
        summary: result.summary as Record<string, any> | null,
      } as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to update document result ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update document result');
    }
  }

  async updateDocumentResultStatus(
    id: string,
    status: string,
    approvedById?: string,
  ): Promise<DocumentResultResponseDto> {
    try {
      const updateData: {
        status: string;
        reviewedAt?: Date;
        approvedAt?: Date;
        approvedById?: string;
      } = {
        status,
      };

      // Set timestamps based on status
      if (status === 'reviewed') {
        updateData.reviewedAt = new Date();
      } else if (status === 'approved') {
        updateData.approvedAt = new Date();
        if (approvedById) {
          updateData.approvedById = approvedById;
        }
      }

      const result = await this.prisma.documentResult.update({
        where: { id },
        data: updateData as any,
        select: {
          id: true,
          jobId: true,
          jsonUrl: true,
          csvUrl: true,
          createdAt: true,
          summary: true,
          status: true,
          reviewedAt: true,
          approvedAt: true,
          approvedById: true,
          items: {
            select: {
              id: true,
              resultId: true,
              name: true,
              quantity: true,
              unitPrice: true,
              total: true,
              tax: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      this.logger.log(`Document result ${id} status updated to ${status}`);

      return {
        ...result,
        summary: result.summary as Record<string, any> | null,
      } as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to update document result status ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update document result status');
    }
  }
}
