import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FieldEditDto } from './extracted-field.dto';
import { LineItemEditDto } from './line-item.dto';

/**
 * Payload for editing a document result from the Document Editor.
 * `fields` upserts corrected values by canonical key (only listed fields change).
 * `lineItems`, when provided, fully replaces the existing rows.
 */
export class UpdateDocumentResultDto {
  @ApiPropertyOptional({
    description: 'Corrected header fields, matched/created by canonical key.',
    type: [FieldEditDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldEditDto)
  @IsOptional()
  fields?: FieldEditDto[];

  @ApiPropertyOptional({
    description: 'Corrected line items. Replaces the existing rows entirely.',
    type: [LineItemEditDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemEditDto)
  @IsOptional()
  lineItems?: LineItemEditDto[];
}
