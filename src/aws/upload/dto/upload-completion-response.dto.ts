import { ApiProperty } from '@nestjs/swagger';

export class UploadCompletionResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the created upload record',
  })
  uploadId!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the created document record',
  })
  documentId!: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID of the created job record',
  })
  jobId!: string;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    description: 'SQS message ID for the queued processing task',
  })
  sqsMessageId!: string;

  @ApiProperty({
    example: 'success',
    description: 'Status of the upload completion operation',
    enum: ['success'],
  })
  status!: 'success';
}
