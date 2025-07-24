import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  Logger,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { CompanyUserGuard } from 'src/auth/guards/companyUser.guard';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { WorkspaceCreateGuard } from 'src/auth/guards/workspaceCreate.guard';

@Controller('workspace')
@ApiTags('workspace')
export class WorkspaceController {
  logger = new Logger();
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'The record has been created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceCreateGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: JwtPayload) {
    this.logger.log('USER ID', user.sub);
    return this.workspaceService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspaces' })
  @ApiResponse({ status: 200, description: 'Return all workspaces.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  findAll() {
    return this.workspaceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the workspace with the given id.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyUserGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  findOne(@Param('id') id: string) {
    return this.workspaceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the updated workspace.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the deleted workspace.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspaceService.remove(id);
  }
}
