import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { DocumentService, CreateDocumentDto, DocumentResponseDto } from './document.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { DocumentStatus, DocumentType } from '@prisma/client';

@Controller('documents')
@ApiTags('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Create a new document record after upload' })
  @ApiResponse({
    status: 201,
    description: 'Document record created successfully.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fileName: { type: 'string' },
        documentUrl: { type: 'string' },
        type: { type: 'string', enum: Object.values(DocumentType) },
        status: { type: 'string', enum: Object.values(DocumentStatus) },
        uploadId: { type: 'string' },
        userId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 403, description: 'Access denied to upload.' })
  @ApiResponse({ status: 404, description: 'Upload not found.' })
  create(
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<DocumentResponseDto> {
    return this.documentService.createDocument(dto, user);
  }

  @Get('workspace/:workspaceId')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get all documents in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Return documents in the workspace.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fileName: { type: 'string' },
          documentUrl: { type: 'string' },
          type: { type: 'string', enum: Object.values(DocumentType) },
          status: { type: 'string', enum: Object.values(DocumentStatus) },
          uploadId: { type: 'string' },
          userId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to workspace.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  findByWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<DocumentResponseDto[]> {
    return this.documentService.getDocumentsByWorkspace(workspaceId, user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Return document.',
  })
  @ApiResponse({ status: 403, description: 'Access denied to document.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload): Promise<DocumentResponseDto> {
    return this.documentService.getDocumentById(id, user);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.INTERNAL) // Only admin and internal can update status
  @ApiOperation({ summary: 'Update document processing status (Admin/Internal only)' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document status updated successfully.',
  })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: DocumentStatus,
    @CurrentUser() user: JwtPayload,
  ): Promise<DocumentResponseDto> {
    return this.documentService.updateDocumentStatus(id, status, user);
  }
}
