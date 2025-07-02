import { Controller, Get, Post, Body, Param, Delete, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('company')
@ApiTags('company')

export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'The record has been created successfully.'})
  create(@Body() dto: CreateCompanyDto) {
    return this.companyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all companies' })
  @ApiResponse({ status: 200, description: 'Return all companies.'})
  @ApiResponse({ status: 400, description: 'Bad request.'})
  findAll() {
    return this.companyService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a company by id' })
  @ApiResponse({ status: 200, description: 'Return the company with the given id.'})
  @ApiResponse({ status: 404, description: 'Company not found.'})
  findOne(@Param('id') id: string) {
    return this.companyService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(id, dto);
  }

  @ApiOperation({ summary: 'Update a company by id' })
  @ApiResponse({ status: 200, description: 'Return the updated company.'})
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.companyService.remove(id);
  }
}
