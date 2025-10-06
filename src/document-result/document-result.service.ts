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
import { DocumentResultResponseDto } from './dto/document-result-response.dto';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';

@Injectable()
export class DocumentResultService {
  private readonly logger = new Logger(DocumentResultService.name);

  constructor(private prisma: PrismaService) {}

  async createDocumentResult(data: CreateDocumentResultDto): Promise<DocumentResultResponseDto> {
    const operationId = `create-result-${Date.now()}`;

    this.logger.log(`Creating document result for job ${data.jobId}`, {
      operationId,
      jobId: data.jobId,
      hasJsonUrl: !!data.jsonUrl,
      hasCsvUrl: !!data.csvUrl,
      hasSummary: !!data.summary,
      itemCount: data.items?.length || 0,
    });

    try {
      // Verify job exists and doesn't already have a result
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        select: {
          id: true,
          status: true,
          result: {
            select: { id: true },
          },
        },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${data.jobId} not found`);
      }

      if (job.result) {
        throw new ConflictException(
          `Job ${data.jobId} already has a document result (ID: ${job.result.id})`,
        );
      }

      // Create DocumentResult and InvoiceItems in a transaction
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
}
