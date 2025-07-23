import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyResponseDto, PaginatedCompaniesResponseDto } from './dto/company-response.dto';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    data: CreateCompanyDto,
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CompanyResponseDto> {
    try {
      // Check if company name already exists
      const existingCompany = await tx.company.findUnique({
        where: { name: data.name },
      });

      if (existingCompany) {
        throw new BadRequestException('Company with this name already exists');
      }

      const company = await tx.company.create({
        data: {
          name: data.name,
          ownerId: userId,
          users: {
            connect: {
              id: userId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
          ownerId: true,
        },
      });

      this.logger.log(`Company ${company.id} created by user ${userId}`);
      return company;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to create company: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to create company');
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<PaginatedCompaniesResponseDto> {
    try {
      const skip = (page - 1) * limit;

      const [companies, total] = await Promise.all([
        this.prisma.company.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            createdAt: true,
            ownerId: true,
            users: {
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                createdAt: true,
                companyId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.company.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: companies,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch companies: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch companies');
    }
  }

  async findOne(id: string): Promise<CompanyResponseDto> {
    try {
      const company = await this.prisma.company.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          createdAt: true,
          ownerId: true,
          users: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
              companyId: true,
            },
          },
        },
      });

      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      return company;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch company ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch company');
    }
  }

  async update(id: string, data: UpdateCompanyDto): Promise<CompanyResponseDto> {
    try {
      // Check if company exists
      const existingCompany = await this.prisma.company.findUnique({ where: { id } });
      if (!existingCompany) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      // If name is being updated, check for conflicts
      if (data.name && data.name !== existingCompany.name) {
        const nameExists = await this.prisma.company.findUnique({
          where: { name: data.name },
        });

        if (nameExists) {
          throw new BadRequestException('Company name already exists');
        }
      }

      const updatedCompany = await this.prisma.company.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          createdAt: true,
          ownerId: true,
        },
      });

      this.logger.log(`Company ${id} updated successfully`);
      return updatedCompany;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Handle specific Prisma errors
      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to update company ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update company');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      // Check if company exists
      const company = await this.prisma.company.findUnique({ where: { id } });
      if (!company) {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      await this.prisma.company.delete({ where: { id } });

      this.logger.log(`Company ${id} deleted successfully`);
      return { message: 'Company deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle specific Prisma errors
      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Company with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to delete company ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to delete company');
    }
  }
}
