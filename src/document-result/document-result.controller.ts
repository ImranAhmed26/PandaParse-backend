import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DocumentResultService } from './document-result.service';
import { CreateDocumentResultDto } from './dto/create-document-result.dto';
import { DocumentResultResponseDto } from './dto/document-result-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { InternalApiGuard } from 'src/auth/guards/internal-api.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';

@Controller('document-results')
@ApiTags('document-results')
export class DocumentResultController {
  constructor(private readonly documentResultService: DocumentResultService) {}

  // Internal API endpoint for Lambda to create results
  @Post('internal')
  @UseGuards(InternalApiGuard)
  @ApiOperation({
    summary: 'Create document result (Internal - Lambda only)',
    description: 'Called by Lambda after parsing raw OCR data to store structured results',
  })
  @ApiResponse({
    status: 201,
    description: 'Document result created successfully',
    type: DocumentResultResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data or job not found' })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  @ApiResponse({ status: 409, description: 'Result already exists for this job' })
  async createInternal(@Body() dto: CreateDocumentResultDto): Promise<DocumentResultResponseDto> {
    return this.documentResultService.createDocumentResult(dto);
  }

  // User-facing endpoints
  @Get('job/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get document result by job ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({
    status: 200,
    description: 'Return document result for job',
    type: DocumentResultResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document result not found' })
  async getByJobId(@Param('jobId') jobId: string): Promise<DocumentResultResponseDto> {
    return this.documentResultService.getDocumentResultByJobId(jobId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get document result by ID' })
  @ApiParam({ name: 'id', description: 'Document result ID' })
  @ApiResponse({
    status: 200,
    description: 'Return document result',
    type: DocumentResultResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Document result not found' })
  async getById(@Param('id') id: string): Promise<DocumentResultResponseDto> {
    return this.documentResultService.getDocumentResultById(id);
  }
}