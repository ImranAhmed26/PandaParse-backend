import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { DocumentType } from '@prisma/client';

export class CompleteUploadDto {
  @ApiProperty({
    example: 'invoice.pdf',
    description: 'Original name of the uploaded file',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    example: 'documents/user123/workspace456/invoice-uuid.pdf',
    description: 'S3 object key for the uploaded file',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\-_/.]+$/, {
    message:
      'S3 key must contain only alphanumeric characters, hyphens, underscores, forward slashes, and dots',
  })
  s3Key!: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME type of the uploaded file',
    enum: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
  })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the user who uploaded the file',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  userId!: string;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Workspace ID where the file was uploaded',
  })
  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;

  @ApiProperty({
    example: 'INVOICE',
    description: 'Type of document that was uploaded',
    enum: DocumentType,
  })
  @IsEnum(DocumentType, {
    message:
      'Document type must be one of: INVOICE, RECEIPT, CREDIT_NOTE, PURCHASE_ORDER, BANK_STATEMENT, PAYSLIP, CONTRACT, OTHER',
  })
  documentType!: DocumentType;

  @ApiPropertyOptional({
    example: 1048576,
    description: 'File size in bytes',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value as string))
  fileSize?: number;
}
