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
import { MembershipService } from './membership.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceResponseDto, PaginatedWorkspacesResponseDto } from './dto/workspace-response.dto';
import { ManageMembersDto } from './dto/manage-members.dto';
import { WorkspaceMemberDto } from './dto/workspace-member.dto';
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
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly membershipService: MembershipService,
  ) {}

  @Post()
  @UseGuards(WorkspaceCreateGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({
    summary: 'Create a new workspace with member control',
    description:
      'Create a workspace with automatic member assignment based on addAllUsers flag or userList. Creator is always added as admin member.',
  })
  @ApiResponse({
    status: 201,
    description: 'The workspace has been created successfully with members assigned.',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request, workspace name already exists, or invalid user IDs in userList.',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions to create workspace or users not in company.',
  })
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
    summary: 'Get workspaces (Admin gets all, Users get workspaces where they are members)',
    description:
      'Returns paginated workspaces. Admins see all workspaces, regular users only see workspaces where they are members.',
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
  @ApiQuery({
    name: 'includeMembers',
    required: false,
    type: Boolean,
    description: 'Include workspace members in response (default: false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Return the workspace with the given id.',
    type: WorkspaceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to this workspace.' })
  findOne(
    @Param('id') id: string,
    @Query('includeMembers') includeMembers: boolean = false,
  ): Promise<WorkspaceResponseDto> {
    return this.workspaceService.findOne(id, includeMembers);
  }

  @Patch(':id')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ 
    summary: 'Update a workspace by id (creator only)',
    description: 'Only the workspace creator or admin can update workspace details.'
  })
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
  @ApiOperation({ 
    summary: 'Delete a workspace by id (creator only)',
    description: 'Only the workspace creator or admin can delete a workspace. All members are automatically removed.'
  })
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

  // Member management endpoints

  @Get(':id/members')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get all members of a workspace' })
  @ApiResponse({
    status: 200,
    description: 'Return all members of the workspace.',
    type: [WorkspaceMemberDto],
  })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to this workspace.' })
  async getMembers(@Param('id') id: string): Promise<WorkspaceMemberDto[]> {
    return this.membershipService.getWorkspaceMembers(id);
  }

  @Post(':id/members')
  @UseGuards(WorkspaceAccessGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Manage workspace members (add/remove)' })
  @ApiResponse({
    status: 200,
    description: 'Members have been successfully managed.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Members updated successfully' },
        added: { type: 'number', example: 2 },
        removed: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request or invalid user IDs.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiResponse({ status: 403, description: 'Access denied to manage workspace members.' })
  async manageMembers(
    @Param('id') id: string,
    @Body() dto: ManageMembersDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ message: string; added: number; removed: number }> {
    let addedCount = 0;
    let removedCount = 0;

    // Get user's company ID for validation
    const userInfo = await this.membershipService.getUserCompanyInfo(user.sub);

    if (dto.addUsers && dto.addUsers.length > 0) {
      await this.membershipService.addMembersToWorkspace(
        id,
        dto.addUsers,
        user.sub,
        userInfo.companyId,
      );
      addedCount = dto.addUsers.length;
    }

    if (dto.removeUsers && dto.removeUsers.length > 0) {
      await this.membershipService.removeMembersFromWorkspace(id, dto.removeUsers, user.sub);
      removedCount = dto.removeUsers.length;
    }

    return {
      message: 'Members updated successfully',
      added: addedCount,
      removed: removedCount,
    };
  }
}
