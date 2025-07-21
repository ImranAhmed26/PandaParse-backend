import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsInt, IsIn } from 'class-validator';
import { OWNER_TYPES } from 'src/common/constants/enums';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  ownerId!: string;

  @IsOptional()
  @IsInt()
  @IsIn(Object.values(OWNER_TYPES))
  @ApiPropertyOptional({
    description: 'Owner type: 0=USER, 1=COMPANY',
    enum: Object.values(OWNER_TYPES),
    default: OWNER_TYPES.USER,
  })
  ownerType?: number;
}
