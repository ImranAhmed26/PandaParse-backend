import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { ExtractedFieldResponseDto } from './extracted-field.dto';
import { LineItemResponseDto } from './line-item.dto';

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

  @ApiProperty({ enum: DocumentType })
  docType!: DocumentType;

  @ApiPropertyOptional()
  jsonUrl?: string | null;

  @ApiPropertyOptional()
  csvUrl?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [ExtractedFieldResponseDto] })
  fields!: ExtractedFieldResponseDto[];

  @ApiProperty({ type: [LineItemResponseDto] })
  lineItems!: LineItemResponseDto[];

  @ApiProperty({ enum: DocumentResultStatus, default: DocumentResultStatus.draft })
  status!: DocumentResultStatus;

  @ApiPropertyOptional()
  reviewedAt?: Date | null;

  @ApiPropertyOptional()
  approvedAt?: Date | null;

  @ApiPropertyOptional()
  approvedById?: string | null;
}
