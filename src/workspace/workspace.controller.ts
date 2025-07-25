import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceResponseDto, PaginatedWorkspacesResponseDto } from './dto/workspace-response.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { WorkspaceCreateGuard } from 'src/auth/guards/workspaceCreate.guard';
import { WorkspaceAccessGuard } from 'src/auth/guards/workspace-access.guard';

@Controller('workspace')
@ApiTags('workspace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @UseGuards(WorkspaceCreateGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({
    status: 201,
    description: 'The workspace has been created successfully.',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request or workspace name already exists.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to create workspace.' })
  create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.create(dto, user);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({
    summary: 'Get workspaces (Admin gets all, Users get their accessible workspaces)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Return paginated workspaces.',
    type: PaginatedWorkspacesResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ): Promise<PaginatedWorkspacesResponseDto> {
    // Admins get all workspaces, regular users get only their accessible workspaces
    if (user.role === USER_ROLES.ADMIN) {
      return this.workspaceService.findAll(page, limit);
    } else {
      return this.workspaceService.findUserWorkspaces(user, page, limit);
    }
  }

  @Get(':id')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get a workspace by id (with access control)' })
  @ApiResponse({
    status: 200,
    description: 'Return the workspace with the given id.',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to this workspace.' })
  findOne(@Param('id') id: string): Promise<WorkspaceResponseDto> {
    return this.workspaceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Update a workspace by id (with access control)' })
  @ApiResponse({
    status: 200,
    description: 'The workspace has been updated successfully.',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to this workspace.' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    return this.workspaceService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Delete a workspace by id (with access control)' })
  @ApiResponse({
    status: 200,
    description: 'The workspace has been deleted successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Workspace deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to this workspace.' })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.workspaceService.remove(id);
  }
}
