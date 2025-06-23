import { Controller, Get, Query } from '@nestjs/common';
import { S3UploadUrlService } from '../s3-upload-url/s3-upload-url.service';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly s3UploadUrlService: S3UploadUrlService) {}

  @Get('generate-url')
  @ApiOperation({ summary: 'Generate a pre-signed URL for file upload' })
  @ApiQuery({ name: 'type', required: false, description: 'File type (e.g., pdf, png, jpg, jpeg)' })
  @ApiResponse({
    status: 200,
    description: 'Returns a pre-signed URL and file key',
    schema: {
      example: {
        url: 'https://s3.eu-west-1.amazonaws.com/invoice-uploads/uploads/uuid.pdf?...',
        key: 'uploads/uuid.pdf',
      },
    },
  })
  async getUploadUrl(@Query('type') type: string) {
    return await this.s3UploadUrlService.generateUploadUrl(type || 'pdf');
  }
}
