import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  forwardRef,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserUpdateDto } from './dto/user-update.dto';
import { UserResponseDto, PaginatedUsersResponseDto } from './dto/user-response.dto';
import { CompanyService } from 'src/company/company.service';
import { USER_ROLES } from 'src/common/constants/enums';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CompanyService))
    private companyService: CompanyService,
  ) {}

  async create(userCreateDto: UserCreateDto): Promise<UserResponseDto> {
    const { companyName, password, ...userData } = userCreateDto;

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      // Hash password if provided
      const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

      return await this.prisma.$transaction(async tx => {
        const user = await tx.user.create({
          data: {
            ...userData,
            password: hashedPassword || '',
            role: userData.role ?? USER_ROLES.USER,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            companyId: true,
          },
        });

        if (companyName) {
          const company = await this.companyService.create({ name: companyName }, user.id, tx);

          const updatedUser = await tx.user.update({
            where: { id: user.id },
            data: { companyId: company.id },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              createdAt: true,
              companyId: true,
            },
          });

          this.logger.log(`User ${user.id} created with company ${company.id}`);
          return updatedUser;
        }

        this.logger.log(`User ${user.id} created successfully`);
        return user;
      });
    } catch (error: unknown) {
      this.logger.error(`Failed to create user: ${getErrorMessage(error)}`, getErrorStack(error));

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(page: number = 1, limit: number = 10): Promise<PaginatedUsersResponseDto> {
    try {
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            companyId: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: users,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch users: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findOne(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          companyId: true,
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch user ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch user');
    }
  }

  async update(id: string, userUpdateDto: UserUpdateDto): Promise<UserResponseDto> {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({ where: { id } });
      if (!existingUser) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // If email is being updated, check for conflicts
      if (userUpdateDto.email && userUpdateDto.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: userUpdateDto.email },
        });

        if (emailExists) {
          throw new BadRequestException('Email already exists');
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: userUpdateDto,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          companyId: true,
        },
      });

      this.logger.log(`User ${id} updated successfully`);
      return updatedUser;
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      // Handle specific Prisma errors
      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to update user ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.prisma.user.delete({ where: { id } });

      this.logger.log(`User ${id} deleted successfully`);
      return { message: 'User deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle specific Prisma errors
      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to delete user ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  // Helper method for authentication services
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }
}
