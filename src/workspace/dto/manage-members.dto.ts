import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class ManageMembersDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'addUsers array cannot be empty if provided' })
  @IsUUID('4', { each: true, message: 'Each user ID in addUsers must be a valid UUID' })
  @ApiPropertyOptional({
    description: 'Array of user IDs to add as workspace members',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-b789-123456789abc'],
    type: [String],
  })
  addUsers?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'removeUsers array cannot be empty if provided' })
  @IsUUID('4', { each: true, message: 'Each user ID in removeUsers must be a valid UUID' })
  @ApiPropertyOptional({
    description: 'Array of user IDs to remove from workspace members',
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    type: [String],
  })
  removeUsers?: string[];
}
