import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { S3ObjectService } from '../aws/s3-object/s3-object.service';
import { CreateDocumentResultDto } from './dto/create-document-result.dto';
import { UpdateDocumentResultDto } from './dto/update-document-result.dto';
import { DocumentResultResponseDto } from './dto/document-result-response.dto';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { DocumentStatus } from '@prisma/client';
import { canonicalFieldDef, deriveNumericValue, mapTextractResult } from './textract.mapper';

/** Shared select for returning a fully-populated result. */
const RESULT_SELECT = {
  id: true,
  jobId: true,
  docType: true,
  jsonUrl: true,
  csvUrl: true,
  createdAt: true,
  status: true,
  reviewedAt: true,
  approvedAt: true,
  approvedById: true,
  fields: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      key: true,
      label: true,
      dataType: true,
      detectedValue: true,
      value: true,
      numericValue: true,
      confidence: true,
      page: true,
      boundingBox: true,
      isEdited: true,
    },
  },
  lineItems: {
    orderBy: { rowIndex: 'asc' as const },
    select: {
      id: true,
      rowIndex: true,
      description: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      tax: true,
      taxRate: true,
      productCode: true,
      boundingBox: true,
      confidence: true,
      cells: true,
    },
  },
} satisfies Prisma.DocumentResultSelect;

/** null -> Postgres NULL for nullable Json columns (Prisma requires a sentinel). */
function jsonOrNull(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v == null ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

@Injectable()
export class DocumentResultService {
  private readonly logger = new Logger(DocumentResultService.name);

  constructor(
    private prisma: PrismaService,
    private readonly s3Object: S3ObjectService,
  ) {}

  /**
   * Called by the OCR Lambda. Reads the raw Textract JSON from S3 (`jsonUrl`),
   * materializes the canonical fields + line items, and persists them alongside the
   * result. If `documentProcessed` is false the document is flagged and no result is made.
   */
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
    });

    try {
      const job = await this.prisma.job.findUnique({
        where: { id: data.jobId },
        select: {
          id: true,
          type: true,
          result: { select: { id: true } },
          upload: {
            select: {
              document: { select: { id: true } },
            },
          },
        },
      });

      if (!job) {
        throw new NotFoundException(`Job with ID ${data.jobId} not found`);
      }

      const document = job.upload?.document;
      if (!document) {
        throw new NotFoundException(`No document found for job ${data.jobId}`);
      }

      // Processing failed upstream — flag the document, create no result.
      if (!data.documentProcessed) {
        await this.prisma.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.FLAGGED },
        });
        this.logger.log(
          `Document ${document.id} status updated to FLAGGED (job ${data.jobId} failed processing)`,
          { operationId, documentId: document.id, jobId: data.jobId },
        );
        return null;
      }

      if (job.result) {
        throw new ConflictException(
          `Job ${data.jobId} already has a document result (ID: ${job.result.id})`,
        );
      }

      // Materialize the curated field model from the raw Textract JSON in S3.
      const parsed = data.jsonUrl ? await this.s3Object.getJson(data.jsonUrl) : null;
      const mapped = mapTextractResult(parsed);

      if (!parsed) {
        this.logger.warn(
          `No parsed JSON available for job ${data.jobId} (key=${data.jsonUrl ?? 'none'}); creating result with no fields`,
          { operationId },
        );
      }

      const result = await this.prisma.$transaction(async tx => {
        const created = await tx.documentResult.create({
          data: {
            jobId: data.jobId,
            docType: job.type,
            jsonUrl: data.jsonUrl,
            csvUrl: data.csvUrl,
            fields: {
              create: mapped.fields.map(f => ({
                key: f.key,
                label: f.label,
                dataType: f.dataType,
                detectedValue: f.detectedValue,
                value: f.detectedValue, // current value starts equal to the detection
                numericValue: f.numericValue,
                confidence: f.confidence,
                page: f.page,
                boundingBox: jsonOrNull(f.boundingBox),
              })),
            },
            lineItems: {
              create: mapped.lineItems.map(li => ({
                rowIndex: li.rowIndex,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                amount: li.amount,
                tax: li.tax,
                taxRate: li.taxRate,
                productCode: li.productCode,
                boundingBox: jsonOrNull(li.boundingBox),
                confidence: li.confidence,
                cells: jsonOrNull(li.cells),
              })),
            },
          },
          select: RESULT_SELECT,
        });

        await tx.document.update({
          where: { id: document.id },
          data: { status: DocumentStatus.PROCESSED },
        });

        return created;
      });

      this.logger.log(`Document result created successfully`, {
        operationId,
        resultId: result.id,
        jobId: data.jobId,
        fieldCount: result.fields.length,
        lineItemCount: result.lineItems.length,
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
        { operationId, jobId: data.jobId, errorCode, stack: getErrorStack(error) },
      );
      throw new InternalServerErrorException('Failed to create document result');
    }
  }

  async getDocumentResultByJobId(jobId: string): Promise<DocumentResultResponseDto> {
    try {
      const result = await this.prisma.documentResult.findUnique({
        where: { jobId },
        select: RESULT_SELECT,
      });

      if (!result) {
        throw new NotFoundException(`Document result for job ${jobId} not found`);
      }

      return result as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

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
        select: RESULT_SELECT,
      });

      if (!result) {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      return result as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Failed to fetch document result ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch document result');
    }
  }

  /**
   * Edit a document result from the Document Editor. `fields` upserts corrected values
   * by canonical key (isEdited is derived by comparing to the original detection);
   * `lineItems` replaces the row set, preserving detection detail on rows kept by index.
   */
  async updateDocumentResult(
    id: string,
    dto: UpdateDocumentResultDto,
  ): Promise<DocumentResultResponseDto> {
    try {
      const existing = await this.prisma.documentResult.findUnique({
        where: { id },
        select: {
          id: true,
          fields: { select: { key: true, detectedValue: true, dataType: true } },
          lineItems: { select: { rowIndex: true } },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Document result with ID ${id} not found`);
      }

      const detectedByKey = new Map(existing.fields.map(f => [f.key, f.detectedValue]));
      const dataTypeByKey = new Map(existing.fields.map(f => [f.key, f.dataType]));

      await this.prisma.$transaction(async tx => {
        // --- Header fields: upsert corrected values by canonical key ---
        for (const edit of dto.fields ?? []) {
          const value = edit.value ?? null;
          const detected = detectedByKey.get(edit.key) ?? null;
          const isEdited = value !== detected;
          const def = canonicalFieldDef(edit.key);
          const dataType = dataTypeByKey.get(edit.key) ?? def.dataType;
          // Re-derive the stored numeric (amount for money/number, epoch-ms for dates).
          const numericValue = deriveNumericValue(dataType, value);

          await tx.extractedField.upsert({
            where: { resultId_key: { resultId: id, key: edit.key } },
            update: { value, numericValue, isEdited },
            create: {
              resultId: id,
              key: def.key,
              label: def.label,
              dataType: def.dataType,
              detectedValue: null,
              value,
              numericValue,
              isEdited,
            },
          });
        }

        // --- Line items: upsert provided rows by index, drop the rest ---
        if (dto.lineItems !== undefined) {
          const rows = dto.lineItems.map((li, i) => ({
            ...li,
            rowIndex: li.rowIndex ?? i,
          }));
          const keepIndexes = rows.map(r => r.rowIndex);

          await tx.lineItem.deleteMany({
            where: { resultId: id, rowIndex: { notIn: keepIndexes.length ? keepIndexes : [-1] } },
          });

          for (const r of rows) {
            await tx.lineItem.upsert({
              where: { resultId_rowIndex: { resultId: id, rowIndex: r.rowIndex } },
              update: {
                description: r.description ?? null,
                quantity: r.quantity ?? null,
                unitPrice: r.unitPrice ?? null,
                amount: r.amount ?? null,
                tax: r.tax ?? null,
                taxRate: r.taxRate ?? null,
                productCode: r.productCode ?? null,
              },
              create: {
                resultId: id,
                rowIndex: r.rowIndex,
                description: r.description ?? null,
                quantity: r.quantity ?? null,
                unitPrice: r.unitPrice ?? null,
                amount: r.amount ?? null,
                tax: r.tax ?? null,
                taxRate: r.taxRate ?? null,
                productCode: r.productCode ?? null,
              },
            });
          }
        }
      });

      const result = await this.prisma.documentResult.findUniqueOrThrow({
        where: { id },
        select: RESULT_SELECT,
      });

      this.logger.log(`Document result ${id} updated (fields/line items edited)`);
      return result as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

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
      const updateData: Prisma.DocumentResultUpdateInput = {
        status: status as Prisma.DocumentResultUpdateInput['status'],
      };

      if (status === 'reviewed') {
        updateData.reviewedAt = new Date();
      } else if (status === 'approved') {
        updateData.approvedAt = new Date();
        if (approvedById) {
          updateData.approvedBy = { connect: { id: approvedById } };
        }
      }

      const result = await this.prisma.documentResult.update({
        where: { id },
        data: updateData,
        select: RESULT_SELECT,
      });

      this.logger.log(`Document result ${id} status updated to ${status}`);
      return result as DocumentResultResponseDto;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;

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
