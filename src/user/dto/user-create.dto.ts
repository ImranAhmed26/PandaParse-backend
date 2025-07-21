import { IsEmail, IsNotEmpty, IsInt, IsOptional, IsString, Min, Max, IsIn } from 'class-validator';
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
  @IsInt()
  @IsIn(Object.values(USER_ROLES))
  @ApiProperty({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER,
  })
  role?: number;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  companyId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  companyName?: string;
}
