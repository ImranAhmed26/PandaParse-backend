import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  @ApiProperty()
  ownerId!: string;

  @IsUUID()
  @IsOptional()
  @ApiPropertyOptional()
  ownerType?: string;
}
