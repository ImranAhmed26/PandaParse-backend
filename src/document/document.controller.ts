import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete } from '@nestjs/common';
import { DocumentService, CreateDocumentDto, DocumentResponseDto } from './document.service';
import { BulkDeleteDocumentsDto } from './dto/bulk-delete-documents.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { InternalApiGuard } from 'src/auth/guards/internal-api.guard';
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

  @Delete('workspace/:workspaceId')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Delete all documents in a workspace' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
  @ApiResponse({
    status: 200,
    description: 'Workspace documents deleted successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        deletedCount: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to workspace.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async deleteWorkspaceDocuments(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const deletedCount = await this.documentService.deleteWorkspaceDocuments(workspaceId, user);
    return {
      message: `Successfully deleted ${deletedCount} documents from workspace`,
      deletedCount,
    };
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

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Delete document by ID' })
  @ApiParam({ name: 'id', description: 'Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Access denied to document.' })
  @ApiResponse({ status: 404, description: 'Document not found.' })
  async deleteDocument(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string }> {
    await this.documentService.deleteDocument(id, user);
    return { message: 'Document deleted successfully' };
  }

  @Delete('bulk')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Delete multiple documents by IDs' })
  @ApiResponse({
    status: 200,
    description: 'Bulk delete results.',
    schema: {
      type: 'object',
      properties: {
        successful: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of successfully deleted documents',
        },
        failed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              error: { type: 'string' },
            },
          },
          description: 'IDs and errors for failed deletions',
        },
        totalRequested: { type: 'number' },
        totalSuccessful: { type: 'number' },
        totalFailed: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  async bulkDeleteDocuments(@Body() dto: BulkDeleteDocumentsDto, @CurrentUser() user: JwtPayload) {
    return this.documentService.bulkDeleteDocuments(dto.documentIds, user);
  }

  // Internal API endpoints
  @Post('internal')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Create document record for internal operations' })
  @ApiResponse({
    status: 201,
    description: 'Document created successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  createInternal(
    @Body() dto: CreateDocumentDto & { userId: string },
  ): Promise<DocumentResponseDto> {
    // Create a mock user payload for internal operations
    const internalUser: JwtPayload = {
      sub: dto.userId,
      email: 'internal@system.com',
      role: 0, // Admin role for internal operations
    };

    return this.documentService.createDocument(dto, internalUser);
  }

  @Patch('internal/:id/status')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Update document status for internal operations' })
  @ApiResponse({
    status: 200,
    description: 'Document status updated successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  updateInternalStatus(
    @Param('id') id: string,
    @Body('status') status: DocumentStatus,
  ): Promise<DocumentResponseDto> {
    // Internal operations don't need user validation
    return this.documentService.updateDocumentStatus(id, status);
  }

  @Delete('internal/:id')
  @UseGuards(InternalApiGuard)
  @ApiOperation({ summary: 'Delete document for internal operations' })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully for internal use',
  })
  @ApiResponse({ status: 401, description: 'Invalid internal API key' })
  async deleteInternalDocument(@Param('id') id: string): Promise<{ message: string }> {
    // Create a mock admin user for internal operations
    const internalUser: JwtPayload = {
      sub: 'internal-system',
      email: 'internal@system.com',
      role: 0, // Admin role for internal operations
    };

    await this.documentService.deleteDocument(id, internalUser);
    return { message: 'Document deleted successfully' };
  }
}
