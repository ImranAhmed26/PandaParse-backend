import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  ValidateIf,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required' })
  @MinLength(1, { message: 'Workspace name must be at least 1 character long' })
  @MaxLength(100, { message: 'Workspace name must not exceed 100 characters' })
  @ApiProperty({
    description: 'Name of the workspace (must be unique per creator)',
    example: 'Marketing Team Workspace',
    minLength: 1,
    maxLength: 100,
  })
  name!: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Add all users from company to workspace (only for company owners)',
    example: true,
    default: false,
  })
  addAllUsers?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each user ID must be a valid UUID' })
  @ValidateIf((o: CreateWorkspaceDto) => !o.addAllUsers)
  @ApiPropertyOptional({
    description: 'Array of user IDs to add as workspace members (ignored if addAllUsers is true)',
    example: ['123e4567-e89b-12d3-a456-426614174000', '987fcdeb-51a2-43d1-b789-123456789abc'],
    type: [String],
  })
  userList?: string[];
}
