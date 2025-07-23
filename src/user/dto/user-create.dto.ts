import {
  IsEmail,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  MinLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_ROLES } from 'src/common/constants/enums';

export class UserCreateDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: 2,
  })
  name!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'securePassword123',
    minLength: 8,
  })
  password!: string;

  @IsOptional()
  @IsInt()
  @IsIn(Object.values(USER_ROLES), { message: 'Invalid role value' })
  @ApiPropertyOptional({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER,
    example: USER_ROLES.USER,
  })
  role?: number;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  @ApiPropertyOptional({
    description: 'Company ID (UUID format)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  companyId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters long' })
  @ApiPropertyOptional({
    description: 'Company name (will create new company if provided)',
    example: 'Acme Corporation',
    minLength: 2,
  })
  companyName?: string;
}
