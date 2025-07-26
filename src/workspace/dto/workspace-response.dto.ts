import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceMemberDto } from './workspace-member.dto';

export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({
    description: 'Owner type: 0=USER, 1=COMPANY',
    enum: [0, 1],
  })
  ownerType!: number;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Number of members in this workspace',
    example: 5,
  })
  memberCount?: number;

  @ApiPropertyOptional({
    description: 'List of workspace members (included when specifically requested)',
    type: [WorkspaceMemberDto],
  })
  members?: WorkspaceMemberDto[];
}

export class PaginatedWorkspacesResponseDto {
  @ApiProperty({ type: [WorkspaceResponseDto] })
  data!: WorkspaceResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
