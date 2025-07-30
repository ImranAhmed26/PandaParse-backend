import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GeneratePresignedUrlDto {
  @ApiProperty({
    example: 'invoice.pdf',
    description: 'Name of the file to upload',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME type of the file',
    enum: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ],
  })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiPropertyOptional({
    example: 1048576,
    description: 'File size in bytes',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  fileSize?: number;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Workspace ID to organize the uploaded file',
  })
  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;
}
