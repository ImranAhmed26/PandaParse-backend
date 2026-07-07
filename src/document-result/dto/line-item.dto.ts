import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { BoundingBoxDto } from './extracted-field.dto';

/** One line-item row with typed, exportable columns plus its detection detail. */
export class LineItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  rowIndex!: number;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  quantity?: number | null;

  @ApiPropertyOptional()
  unitPrice?: number | null;

  @ApiPropertyOptional()
  amount?: number | null;

  @ApiPropertyOptional()
  tax?: number | null;

  @ApiPropertyOptional()
  productCode?: string | null;

  @ApiPropertyOptional({ type: BoundingBoxDto, nullable: true })
  boundingBox?: BoundingBoxDto | null;

  @ApiPropertyOptional()
  confidence?: number | null;

  @ApiPropertyOptional({ description: 'Per-cell OCR detail keyed by Textract type', nullable: true })
  cells?: Record<string, unknown> | null;
}

/** One corrected line-item row from the Document Editor. */
export class LineItemEditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  rowIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tax?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productCode?: string | null;
}
