import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceItemDto } from './invoice-item.dto';

/**
 * Payload for editing a document result from the Document Editor.
 * Any provided field replaces the stored value; omitted fields are left untouched.
 * `items`, when provided, fully replaces the existing line items.
 */
export class UpdateDocumentResultDto {
  @ApiPropertyOptional({
    description: 'Corrected summary fields (vendor, totals, dates, etc.)',
    example: { vendorName: 'ACME Corp', invoiceTotal: '1100.00', invoiceDate: '2024-01-15' },
  })
  @IsObject()
  @IsOptional()
  summary?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Corrected line items. Replaces the existing items entirely.',
    type: [InvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  @IsOptional()
  items?: InvoiceItemDto[];
}
