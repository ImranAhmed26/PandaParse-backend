import { IsString, IsOptional, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Workspace name cannot be empty' })
  @MinLength(1, { message: 'Workspace name must be at least 1 character long' })
  @MaxLength(100, { message: 'Workspace name must not exceed 100 characters' })
  @ApiPropertyOptional({
    description: 'Workspace name (must be unique per creator)',
    example: 'Updated Marketing Team Workspace',
    minLength: 1,
    maxLength: 100,
  })
  name?: string;
}
