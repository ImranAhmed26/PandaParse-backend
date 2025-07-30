import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UploadStatus } from '@prisma/client';

export class UpdateUploadStatusDto {
  @ApiProperty({
    example: 'processing',
    description: 'New status for the upload',
    enum: UploadStatus,
  })
  @IsEnum(UploadStatus)
  status!: UploadStatus;
}
