import { IsArray, IsUUID, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteDocumentsDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-9f4e-123456789abc'],
    description: 'Array of document IDs to delete',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one document ID is required' })
  @ArrayMaxSize(100, { message: 'Cannot delete more than 100 documents at once' })
  @IsUUID('4', { each: true, message: 'Each document ID must be a valid UUID' })
  documentIds!: string[];
}
