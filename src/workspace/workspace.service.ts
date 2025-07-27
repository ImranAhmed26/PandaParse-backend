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
import { MembershipService } from './membership.service';
import { OWNER_TYPES, USER_ROLES } from 'src/common/constants/enums';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { getErrorMessage, getErrorStack, getPrismaErrorCode } from 'src/common/types/error.types';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private membershipService: MembershipService,
  ) {}
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

      // Check if workspace name already exists for this creator (application-level check)
      const existingWorkspace = await this.prisma.workspace.findFirst({
        where: {
          creatorId: user.sub,
          name: data.name,
        },
      });

      if (existingWorkspace) {
        throw new BadRequestException(
          `You already have a workspace named "${data.name}". Please choose a different name.`,
        );
      }

      // Determine ownerType & ownerId
      type OwnerType = (typeof OWNER_TYPES)[keyof typeof OWNER_TYPES];
      let ownerType: OwnerType = OWNER_TYPES.USER;
      let ownerId = user.sub;

      if (userRecord.companyId && user.role !== USER_ROLES.ADMIN) {
        ownerType = OWNER_TYPES.COMPANY;
        ownerId = userRecord.companyId;
      }

      // Determine members to add based on user type and request parameters
      let membersToAdd: string[] = [];

      if (userRecord.companyId) {
        // Company owner creating workspace
        if (data.addAllUsers) {
          // Get all users in the company
          const companyUsers = await this.prisma.user.findMany({
            where: { companyId: userRecord.companyId },
            select: { id: true },
          });
          membersToAdd = companyUsers.map(u => u.id);
        } else if (data.userList && data.userList.length > 0) {
          // Validate that all users in userList belong to the company
          await this.membershipService.validateMembershipEligibility(
            data.userList,
            userRecord.companyId,
          );
          membersToAdd = data.userList;
        }

        // Always ensure creator is included
        if (!membersToAdd.includes(user.sub)) {
          membersToAdd.push(user.sub);
        }
      } else {
        // Solo user - only add themselves
        membersToAdd = [user.sub];
      }

      // Create workspace and members in a transaction
      const result = await this.prisma.$transaction(async tx => {
        // Create the workspace
        const workspace = await tx.workspace.create({
          data: {
            name: data.name,
            ownerId,
            ownerType,
            creatorId: user.sub,
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

        // Create workspace members
        const memberData = membersToAdd.map(userId => ({
          workspaceId: workspace.id,
          userId,
          role: userId === user.sub ? 2 : 0, // Creator gets ADMIN (2), others get VIEWER (0)
        }));

        await tx.workspaceMember.createMany({
          data: memberData,
        });

        return workspace;
      });

      // Get member count for response
      const memberCount = await this.membershipService.getWorkspaceMemberCount(result.id);

      this.logger.log(
        `Workspace "${result.name}" (${result.id}) created by user ${user.sub} with ${memberCount} members`,
      );

      return {
        ...result,
        memberCount,
      };
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2002') {
        throw new BadRequestException(
          `You already have a workspace named "${data.name}". Please choose a different name.`,
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
            _count: {
              select: {
                members: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.workspace.count(),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Transform workspaces to include member count
      const transformedWorkspaces = workspaces.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        ownerType: workspace.ownerType,
        creatorId: workspace.creatorId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        memberCount: workspace._count.members,
      }));

      return {
        data: transformedWorkspaces,
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

  // Method to get workspaces accessible to a specific user (membership-based)
  async findUserWorkspaces(
    user: JwtPayload,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginatedWorkspacesResponseDto> {
    try {
      const skip = (page - 1) * limit;

      // Get workspaces where user is a member
      const [workspaces, total] = await Promise.all([
        this.prisma.workspace.findMany({
          where: {
            members: {
              some: {
                userId: user.sub,
              },
            },
          },
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
            _count: {
              select: {
                members: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.workspace.count({
          where: {
            members: {
              some: {
                userId: user.sub,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Transform workspaces to include member count
      const transformedWorkspaces = workspaces.map(workspace => ({
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        ownerType: workspace.ownerType,
        creatorId: workspace.creatorId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        memberCount: workspace._count.members,
      }));

      return {
        data: transformedWorkspaces,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch user workspaces: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch workspaces');
    }
  }

  async findOne(id: string, includeMembers: boolean = false): Promise<WorkspaceResponseDto> {
    try {
      if (includeMembers) {
        // Query with members included
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
            _count: {
              select: {
                members: true,
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: [
                { role: 'desc' }, // Admins first
                { user: { name: 'asc' } }, // Then alphabetically
              ],
            },
          },
        });

        if (!workspace) {
          throw new NotFoundException(`Workspace with ID ${id} not found`);
        }

        return {
          id: workspace.id,
          name: workspace.name,
          ownerId: workspace.ownerId,
          ownerType: workspace.ownerType,
          creatorId: workspace.creatorId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          memberCount: workspace._count.members,
          members: workspace.members.map(member => ({
            id: member.id,
            userId: member.userId,
            workspaceId: member.workspaceId,
            role: member.role,
            user: member.user,
          })),
        };
      } else {
        // Query without members
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
            _count: {
              select: {
                members: true,
              },
            },
          },
        });

        if (!workspace) {
          throw new NotFoundException(`Workspace with ID ${id} not found`);
        }

        return {
          id: workspace.id,
          name: workspace.name,
          ownerId: workspace.ownerId,
          ownerType: workspace.ownerType,
          creatorId: workspace.creatorId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          memberCount: workspace._count.members,
        };
      }
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
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          creatorId: true,
        },
      });

      if (!existingWorkspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      // If name is being updated, check for uniqueness per creator
      if (data.name && data.name !== existingWorkspace.name) {
        const duplicateWorkspace = await this.prisma.workspace.findFirst({
          where: {
            creatorId: existingWorkspace.creatorId,
            name: data.name,
            id: { not: id }, // Exclude current workspace
          },
        });

        if (duplicateWorkspace) {
          throw new BadRequestException(
            `You already have a workspace named "${data.name}". Please choose a different name.`,
          );
        }
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
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      this.logger.log(`Workspace ${id} updated successfully`);

      return {
        id: updatedWorkspace.id,
        name: updatedWorkspace.name,
        ownerId: updatedWorkspace.ownerId,
        ownerType: updatedWorkspace.ownerType,
        creatorId: updatedWorkspace.creatorId,
        createdAt: updatedWorkspace.createdAt,
        updatedAt: updatedWorkspace.updatedAt,
        memberCount: updatedWorkspace._count.members,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      const errorCode = getPrismaErrorCode(error);
      if (errorCode === 'P2025') {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      if (errorCode === 'P2002') {
        // Handle database-level unique constraint violation
        throw new BadRequestException(
          `You already have a workspace with this name. Please choose a different name.`,
        );
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
      const workspace = await this.prisma.workspace.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          creatorId: true,
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${id} not found`);
      }

      // Delete workspace and cascade delete members in a transaction
      await this.prisma.$transaction(async tx => {
        // Delete all workspace members first
        await tx.workspaceMember.deleteMany({
          where: { workspaceId: id },
        });

        // Delete the workspace
        await tx.workspace.delete({ where: { id } });
      });

      this.logger.log(
        `Workspace ${id} (${workspace.name}) deleted successfully with ${workspace._count.members} members`,
      );
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

  // Get the 6 most recent workspaces for a user based on document upload activity
  async getRecentWorkspaces(user: JwtPayload): Promise<WorkspaceResponseDto[]> {
    try {
      const startTime = Date.now();

      // Get workspaces where user is a member, with most recent document activity
      const workspaces = await this.prisma.workspace.findMany({
        where: {
          members: {
            some: {
              userId: user.sub,
            },
          },
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          ownerType: true,
          creatorId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
            },
          },
          documents: {
            select: {
              document: {
                select: {
                  createdAt: true,
                },
              },
            },
            orderBy: {
              document: {
                createdAt: 'desc',
              },
            },
            take: 1, // Get only the most recent document per workspace
          },
        },
      });

      // Transform and sort workspaces by activity
      const workspacesWithActivity = workspaces.map(workspace => {
        const lastDocumentActivity = workspace.documents[0]?.document?.createdAt;
        const activityTimestamp = lastDocumentActivity || workspace.createdAt;

        return {
          id: workspace.id,
          name: workspace.name,
          ownerId: workspace.ownerId,
          ownerType: workspace.ownerType,
          creatorId: workspace.creatorId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          memberCount: workspace._count.members,
          activityTimestamp,
        };
      });

      // Sort by activity timestamp (most recent first), then by workspace ID for consistency
      const sortedWorkspaces = workspacesWithActivity
        .sort((a, b) => {
          const timeDiff =
            new Date(b.activityTimestamp).getTime() - new Date(a.activityTimestamp).getTime();
          if (timeDiff !== 0) return timeDiff;
          // Use workspace ID as tiebreaker for consistent ordering
          return a.id.localeCompare(b.id);
        })
        .slice(0, 6) // Limit to 6 workspaces
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ activityTimestamp, ...workspace }) => workspace); // Remove temporary field

      const executionTime = Date.now() - startTime;
      this.logger.log(
        `Retrieved ${sortedWorkspaces.length} recent workspaces for user ${user.sub} in ${executionTime}ms`,
      );

      // Log performance warning if query takes too long
      if (executionTime > 500) {
        this.logger.warn(
          `Recent workspaces query for user ${user.sub} took ${executionTime}ms, exceeding 500ms threshold`,
        );
      }

      return sortedWorkspaces;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch recent workspaces for user ${user.sub}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to fetch recent workspaces');
    }
  }

  // Helper method to check if a workspace name is available for a creator
  async checkNameAvailability(
    creatorId: string,
    name: string,
    excludeId?: string,
  ): Promise<{ available: boolean }> {
    try {
      const existingWorkspace = await this.prisma.workspace.findFirst({
        where: {
          creatorId,
          name,
          ...(excludeId && { id: { not: excludeId } }),
        },
      });

      return { available: !existingWorkspace };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to check workspace name availability: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new InternalServerErrorException('Failed to check name availability');
    }
  }
}
