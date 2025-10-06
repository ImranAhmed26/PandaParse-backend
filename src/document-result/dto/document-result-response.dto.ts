import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceItemResponseDto } from './invoice-item.dto';

export enum DocumentResultStatus {
  draft = 'draft',
  reviewed = 'reviewed',
  approved = 'approved',
}

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

  @ApiProperty({ enum: DocumentResultStatus, default: DocumentResultStatus.draft })
  status!: DocumentResultStatus;

  @ApiPropertyOptional()
  reviewedAt?: Date | null;

  @ApiPropertyOptional()
  approvedAt?: Date | null;

  @ApiPropertyOptional()
  approvedById?: string | null;
}
