import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsIn, MinLength, IsEmail, IsUUID } from 'class-validator';
import { USER_ROLES } from 'src/common/constants/enums';

export class UserUpdateDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @ApiPropertyOptional({ 
    description: 'User email address',
    example: 'user@example.com'
  })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @ApiPropertyOptional({ 
    description: 'User full name',
    example: 'John Doe',
    minLength: 2
  })
  name?: string;

  @IsOptional()
  @IsInt()
  @IsIn(Object.values(USER_ROLES), { message: 'Invalid role value' })
  @ApiPropertyOptional({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
    example: USER_ROLES.USER
  })
  role?: number;

  @IsOptional()
  @IsString()
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  @ApiPropertyOptional({ 
    description: 'Company ID (UUID format)',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  companyId?: string;
}
