import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('workspace')
@ApiTags('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'The record has been created successfully.' })
  create(@Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspaces' })
  @ApiResponse({ status: 200, description: 'Return all workspaces.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  findAll() {
    return this.workspaceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the workspace with the given id.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  findOne(@Param('id') id: string) {
    return this.workspaceService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the updated workspace.' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaceService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a workspace by id' })
  @ApiResponse({ status: 200, description: 'Return the deleted workspace.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.workspaceService.remove(id);
  }
}
