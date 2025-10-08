import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';

export class CreateDocumentResultDto {
  @ApiProperty({ description: 'Job ID this result belongs to' })
  @IsString()
  jobId!: string;

  @ApiProperty({ 
    description: 'Whether the document was successfully processed. If false, document status will be set to FLAGGED and no result record will be created.',
    example: true 
  })
  @IsBoolean()
  documentProcessed!: boolean;

  @ApiPropertyOptional({ description: 'S3 URL/key to parsed JSON' })
  @IsString()
  @IsOptional()
  jsonUrl?: string;

  @ApiPropertyOptional({ description: 'S3 URL/key to CSV export' })
  @IsString()
  @IsOptional()
  csvUrl?: string;

  @ApiPropertyOptional({
    description: 'Summary data (vendor, date, total, etc.)',
    example: {
      vendor: 'ACME Corp',
      invoiceNumber: 'INV-001',
      date: '2024-01-15',
      subtotal: 1000.0,
      tax: 100.0,
      total: 1100.0,
    },
  })
  @IsObject()
  @IsOptional()
  summary?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Invoice line items',
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];
}
