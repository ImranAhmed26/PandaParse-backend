import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ 
    description: 'Owner type: 0=USER, 1=COMPANY',
    enum: [0, 1]
  })
  ownerType!: number;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
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