import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { FieldDataType } from '@prisma/client';

/** Normalized bounding box (fractions 0..1 of the page). */
export class BoundingBoxDto {
  @ApiProperty()
  left!: number;

  @ApiProperty()
  top!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  height!: number;
}

/** A single canonical header field, with its original OCR detection and current value. */
export class ExtractedFieldResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Canonical field key, e.g. VENDOR_NAME, TOTAL' })
  key!: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty({ enum: FieldDataType })
  dataType!: FieldDataType;

  @ApiPropertyOptional({ description: 'Original OCR-detected value (immutable)' })
  detectedValue?: string | null;

  @ApiPropertyOptional({ description: 'Current value (edited, or equal to detectedValue)' })
  value?: string | null;

  @ApiPropertyOptional({ description: 'Confidence of the detected value (0..100)' })
  confidence?: number | null;

  @ApiProperty()
  page!: number;

  @ApiPropertyOptional({ type: BoundingBoxDto, nullable: true })
  boundingBox?: BoundingBoxDto | null;

  @ApiProperty()
  isEdited!: boolean;
}

/** One field correction from the Document Editor. Matched to a field by `key`. */
export class FieldEditDto {
  @ApiProperty({ description: 'Canonical key of the field to update/create' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ description: 'Corrected value (null clears it)', nullable: true })
  @IsOptional()
  @IsString()
  value?: string | null;
}
