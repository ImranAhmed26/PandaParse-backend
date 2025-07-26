import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CheckNameAvailabilityDto {
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required' })
  @MinLength(1, { message: 'Workspace name must be at least 1 character long' })
  @MaxLength(100, { message: 'Workspace name must not exceed 100 characters' })
  @ApiProperty({
    description: 'Workspace name to check availability for',
    example: 'My Project Workspace',
    minLength: 1,
    maxLength: 100,
  })
  name!: string;
}

export class NameAvailabilityResponseDto {
  @ApiProperty({
    description: 'Whether the workspace name is available for the current user',
    example: true,
  })
  available!: boolean;

  @ApiProperty({
    description: 'The workspace name that was checked',
    example: 'My Project Workspace',
  })
  name!: string;
}
