import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class InvoiceItemDto {
  @ApiPropertyOptional({ description: 'Item/product name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Quantity' })
  @IsNumber()
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ description: 'Unit price' })
  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Line total' })
  @IsNumber()
  @IsOptional()
  total?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsNumber()
  @IsOptional()
  tax?: number;
}

export class InvoiceItemResponseDto extends InvoiceItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  resultId!: string;

  @ApiProperty()
  createdAt!: Date;
}