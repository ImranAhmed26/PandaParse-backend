import { IsEmail, IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UserCreateDto {
  @IsEmail()
  @ApiProperty()
  email: string;

  @IsNotEmpty()
  @ApiProperty()
  name: string;

  @IsNotEmpty()
  @ApiProperty()
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  companyId?: string;
}
