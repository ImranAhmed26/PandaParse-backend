import { Controller, Get, Post, Body, Param, Delete, Put, Patch, UseGuards } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CompanyUserGuard } from 'src/auth/guards/companyUser.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { CompanyOwnerGuard } from 'src/auth/guards/companyOwner.guard';

@Controller('company')
@ApiTags('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'The record has been created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.USER)
  create(@Body() dto: CreateCompanyDto, @CurrentUser() userId: string) {
    return this.companyService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  @ApiResponse({ status: 200, description: 'Return all companies.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by id' })
  @ApiResponse({ status: 200, description: 'Return the company with the given id.' })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyUserGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.USER)
  findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company by id' })
  @ApiResponse({ status: 200, description: 'Return the updated company.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.USER)
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a company by id' })
  @ApiResponse({ status: 200, description: 'Return the deleted company.' })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyOwnerGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
