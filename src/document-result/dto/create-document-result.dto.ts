import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * Posted by the OCR Lambda after it writes the raw Textract JSON to S3. The backend
 * reads that JSON (from `jsonUrl`) and materializes the canonical fields + line items
 * itself, so no structured data is sent in this payload.
 */
export class CreateDocumentResultDto {
  @ApiProperty({ description: 'Job ID this result belongs to' })
  @IsString()
  jobId!: string;

  @ApiProperty({
    description:
      'Whether the document was successfully processed. If false, document status is set to FLAGGED and no result record is created.',
    example: true,
  })
  @IsBoolean()
  documentProcessed!: boolean;

  @ApiPropertyOptional({ description: 'S3 key to the raw Textract JSON (e.g. ocr/{jobId}.json)' })
  @IsString()
  @IsOptional()
  jsonUrl?: string;

  @ApiPropertyOptional({ description: 'S3 key to the CSV export' })
  @IsString()
  @IsOptional()
  csvUrl?: string;
}
