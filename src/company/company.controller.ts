import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto, PaginatedCompaniesResponseDto } from './dto/company-response.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { USER_ROLES } from 'src/common/constants/enums';
import { Roles } from 'src/auth/decorators/roles.decorators';
import { CompanyUserGuard } from 'src/auth/guards/companyUser.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorators';
import { CompanyOwnerGuard } from 'src/auth/guards/companyOwner.guard';

@Controller('company')
@ApiTags('company')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Create a new company' })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({
    status: 201,
    description: 'The company has been created successfully.',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request or company name already exists.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() userId: string,
  ): Promise<CompanyResponseDto> {
    return this.companyService.create(dto, userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Get all companies with pagination (Admin only)' })
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
    description: 'Return paginated companies.',
    type: PaginatedCompaniesResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ): Promise<PaginatedCompaniesResponseDto> {
    return this.companyService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(CompanyUserGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Get a company by id' })
  @ApiResponse({
    status: 200,
    description: 'Return the company with the given id.',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not a company member.' })
  findOne(@Param('id') id: string): Promise<CompanyResponseDto> {
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(CompanyOwnerGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.USER)
  @ApiOperation({ summary: 'Update a company by id (Owner or Admin only)' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({
    status: 200,
    description: 'The company has been updated successfully.',
    type: CompanyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request or company name already exists.' })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions or not the company owner.' })
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto): Promise<CompanyResponseDto> {
    return this.companyService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CompanyOwnerGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Delete a company by id (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'The company has been deleted successfully.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Company deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Company not found.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions.' })
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.companyService.remove(id);
  }
}
