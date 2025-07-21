import { PartialType } from '@nestjs/mapped-types';
import { UserCreateDto } from './user-create.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, IsIn } from 'class-validator';
import { USER_ROLES } from 'src/common/constants/enums';

export class UserUpdateDto extends PartialType(UserCreateDto) {
  @IsOptional()
  @IsInt()
  @IsIn(Object.values(USER_ROLES))
  @ApiPropertyOptional({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
  })
  role?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  companyId?: string;
}
