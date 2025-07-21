import { ApiProperty } from '@nestjs/swagger';
import { USER_ROLES } from 'src/common/constants/enums';

export class UserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description: 'User role: 0=ADMIN, 1=INTERNAL, 2=USER',
    enum: Object.values(USER_ROLES),
  })
  role!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  companyId?: string;
}
