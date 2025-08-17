import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteOptionsDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether to delete associated upload records (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deleteUpload?: boolean = true;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to delete associated job records (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deleteJob?: boolean = true;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether to delete associated processing results (default: true)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  deleteResults?: boolean = true;
}
