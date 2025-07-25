import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceResponseDto, PaginatedWorkspacesResponseDto } from './dto/workspace-response.dto';
import { OWNER_TYPES, USER_ROLES } from 'src/common/constants/enums';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}
  private logger = new Logger(WorkspaceService.name);

  // create(data: CreateWorkspaceDto, userId: string) {
  //   return this.prisma.workspace.create({
  //     data: {
  //       name: data.name,
  //       ownerId: userId,
  //       ownerType: data.ownerType ?? OWNER_TYPES.USER,
  //     },
  //   });
  // }

  async create(data: CreateWorkspaceDto, user: JwtPayload): Promise<WorkspaceResponseDto> {
    try {
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { companyId: true },
      });

      if (!userRecord) {
        throw new ForbiddenException('User not found');
      }

      // Determine ownerType & ownerId
      type OwnerType = (typeof OWNER_TYPES)[keyof typeof OWNER_TYPES];
      let ownerType: OwnerType = OWNER_TYPES.USER;
      let ownerId = user.sub;

      if (userRecord.companyId && user.role !== USER_ROLES.ADMIN) {
        ownerType = OWNER_TYPES.COMPANY;
        ownerId = userRecord.companyId;
      }

      const workspace = await this.prisma.workspace.create({
        data: {
          name: data.name,
          ownerId,
          ownerType,
          creatorId: user.sub, // Track who actually created the workspace
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          ownerType: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Workspace ${workspace.id} created by user ${user.sub}`);
      return workspace;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2002') {
        throw new BadRequestException(
          `A workspace with the name "${data.name}" already exists in your records.`,
        );
      }

      this.logger.error(
        `Failed to create workspace: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to create workspace');
    }
  }

  // Admin-only method to get all workspaces
  async findAll(page: number = 1, limit: number = 10): Promise<PaginatedWorkspacesResponseDto> {
    try {
      const skip = (page - 1) * limit;

      const [workspaces, total] = await Promise.all([
        this.prisma.workspace.findMany({
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            ownerId: true,
            ownerType: true,
            creatorId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.workspace.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: workspaces,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch workspaces: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch workspaces');
    }
  }

  // Method to get workspaces accessible to a specific user
  async findUserWorkspaces(
    user: JwtPayload,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedWorkspacesResponseDto> {
    try {
      const skip = (page - 1) * limit;

      // Get user details
      const userRecord = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: {
          id: true,
          companyId: true,
        },
      });

      if (!userRecord) {
        throw new ForbiddenException('User not found');
      }

      // Build where clause based on user's access
      const whereClause: Prisma.WorkspaceWhereInput = {
        OR: [
          // User-owned workspaces
          {
            ownerType: OWNER_TYPES.USER,
            ownerId: user.sub,
          },
          // Company workspaces if user belongs to a company
          ...(userRecord.companyId
            ? [
                {
                  ownerType: OWNER_TYPES.COMPANY,
                  ownerId: userRecord.companyId,
                },
              ]
            : []),
        ],
      };

      const [workspaces, total] = await Promise.all([
        this.prisma.workspace.findMany({
          where: whereClause,
          skip,
          take: limit,
          select: {
            id: true,
            name: true,
            ownerId: true,
            ownerType: true,
            creatorId: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.workspace.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: workspaces,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch user workspaces: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch workspaces');
    }
  }

  async findOne(id: string): Promise<WorkspaceResponseDto> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          ownerId: true,
          ownerType: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      return workspace;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to fetch workspace ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch workspace');
    }
  }

  async update(id: string, data: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    try {
      // Check if workspace exists
      const existingWorkspace = await this.prisma.workspace.findUnique({ where: { id } });
      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      const updatedWorkspace = await this.prisma.workspace.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          ownerId: true,
          ownerType: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      this.logger.log(`Workspace ${id} updated successfully`);
      return updatedWorkspace;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to update workspace ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to update workspace');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      // Check if workspace exists
      const workspace = await this.prisma.workspace.findUnique({ where: { id } });
      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      await this.prisma.workspace.delete({ where: { id } });

      this.logger.log(`Workspace ${id} deleted successfully`);
      return { message: 'Workspace deleted successfully' };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      this.logger.error(
        `Failed to delete workspace ${id}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to delete workspace');
    }
  }
}
