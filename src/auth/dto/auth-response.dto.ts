import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES, USER_TYPES } from 'src/common/constants/enums';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
  })
  role!: number;

  @ApiProperty({
    description: 'User type: 0=INDIVIDUAL_FREELANCER, 1=COMPANY_USER, 2=COMPANY_OWNER',
    enum: Object.values(USER_TYPES),
  })
  userType!: number;
}

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
