import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceMemberUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class WorkspaceMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({
    description: 'Member role: 0=VIEWER, 1=EDITOR, 2=ADMIN',
    enum: [0, 1, 2],
    example: 0,
  })
  role!: number;

  @ApiProperty({ type: WorkspaceMemberUserDto })
  user!: WorkspaceMemberUserDto;
}
