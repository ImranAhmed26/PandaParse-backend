import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateUploadRecordDto {
  @ApiProperty({
    example: 'documents/user123/workspace456/invoice-uuid.pdf',
    description: 'S3 object key for the uploaded file',
  })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({
    example: 'invoice.pdf',
    description: 'Original name of the uploaded file',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    example: 'application/pdf',
    description: 'MIME type of the uploaded file',
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
    description: 'Workspace ID where the file was uploaded',
  })
  @IsOptional()
  @IsUUID('4')
  workspaceId?: string;
}
