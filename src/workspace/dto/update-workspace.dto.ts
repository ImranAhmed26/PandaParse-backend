import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  @ApiPropertyOptional()
  name?: string;

}
