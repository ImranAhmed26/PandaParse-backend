import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceItemResponseDto } from './invoice-item.dto';

export class DocumentResultResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  jobId!: string;

  @ApiPropertyOptional()
  jsonUrl?: string | null;

  @ApiPropertyOptional()
  csvUrl?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiPropertyOptional()
  summary?: Record<string, any> | null;

  @ApiPropertyOptional({ type: [InvoiceItemResponseDto] })
  items?: InvoiceItemResponseDto[];
}