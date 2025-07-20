import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;
}

export class AuthResponseDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
