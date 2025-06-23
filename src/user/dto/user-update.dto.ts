import { PartialType } from '@nestjs/mapped-types';
import { UserCreateDto } from './user-create.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UserUpdateDto extends PartialType(UserCreateDto) {
  @IsOptional()
  @IsEnum(UserRole)
  @ApiPropertyOptional({ enum: UserRole })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  companyId?: string;
}
