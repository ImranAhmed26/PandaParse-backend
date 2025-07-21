import { IsEmail, IsNotEmpty, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES } from 'src/common/constants/enums';

export class UserCreateDto {
  @IsEmail()
  @ApiProperty()
  email!: string;

  @IsNotEmpty()
  @ApiProperty()
  name!: string;

  @IsNotEmpty()
  @ApiProperty()
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  @ApiProperty({ enum: UserRole, default: UserRole.USER })
  role?: UserRole;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  companyId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  companyName?: string;
}
