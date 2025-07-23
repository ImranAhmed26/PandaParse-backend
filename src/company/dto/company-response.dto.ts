import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from 'src/user/dto/user-response.dto';

export class CompanyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty({ type: [UserResponseDto], required: false })
  users?: UserResponseDto[];
}

export class PaginatedCompaniesResponseDto {
  @ApiProperty({ type: [CompanyResponseDto] })
  data!: CompanyResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  totalPages!: number;
}
