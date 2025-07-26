import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceMemberDto } from './dto/workspace-member.dto';
import { MEMBER_ROLES } from 'src/common/constants/enums';
import { getErrorMessage, getErrorStack } from 'src/common/types/error.types';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Add members to a workspace with validation
   */
  async addMembersToWorkspace(
    workspaceId: string,
    userIds: string[],
    creatorId: string,
    creatorCompanyId?: string | null,
  ): Promise<void> {
    try {
      // Validate that workspace exists and user is the creator
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, creatorId: true, ownerType: true },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      if (workspace.creatorId !== creatorId) {
        throw new ForbiddenException('Only workspace creator can add members');
      }

      // Validate membership eligibility
      await this.validateMembershipEligibility(userIds, creatorCompanyId);

      // Get existing members to avoid duplicates
      const existingMembers = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          userId: { in: userIds },
        },
        select: { userId: true },
      });

      const existingUserIds = existingMembers.map(m => m.userId);
      const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

      if (newUserIds.length === 0) {
        this.logger.warn(`No new members to add to workspace ${workspaceId}`);
        return;
      }

      // Add new members with VIEWER role by default
      const memberData = newUserIds.map(userId => ({
        workspaceId,
        userId,
        role: MEMBER_ROLES.VIEWER,
      }));

      await this.prisma.workspaceMember.createMany({
        data: memberData,
      });

      this.logger.log(`Added ${newUserIds.length} members to workspace ${workspaceId}`);
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to add members to workspace ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new BadRequestException('Failed to add members to workspace');
    }
  }

  /**
   * Remove members from a workspace with validation
   */
  async removeMembersFromWorkspace(
    workspaceId: string,
    userIds: string[],
    creatorId: string,
  ): Promise<void> {
    try {
      // Validate that workspace exists and user is the creator
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, creatorId: true },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      if (workspace.creatorId !== creatorId) {
        throw new ForbiddenException('Only workspace creator can remove members');
      }

      // Prevent creator from removing themselves
      if (userIds.includes(creatorId)) {
        throw new BadRequestException('Workspace creator cannot be removed from workspace');
      }

      // Remove members
      const deleteResult = await this.prisma.workspaceMember.deleteMany({
        where: {
          workspaceId,
          userId: { in: userIds },
        },
      });

      this.logger.log(`Removed ${deleteResult.count} members from workspace ${workspaceId}`);
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to remove members from workspace ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new BadRequestException('Failed to remove members from workspace');
    }
  }

  /**
   * Validate that users are eligible to be workspace members
   */
  async validateMembershipEligibility(
    userIds: string[],
    creatorCompanyId?: string | null,
  ): Promise<boolean> {
    try {
      if (userIds.length === 0) {
        return true;
      }

      // Get user details
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, companyId: true, role: true },
      });

      // Check if all user IDs exist
      if (users.length !== userIds.length) {
        const foundIds = users.map(u => u.id);
        const missingIds = userIds.filter(id => !foundIds.includes(id));
        throw new BadRequestException(`Invalid user IDs: ${missingIds.join(', ')}`);
      }

      // If creator has a company, validate that all users belong to the same company
      if (creatorCompanyId) {
        const invalidUsers = users.filter(user => user.companyId !== creatorCompanyId);
        if (invalidUsers.length > 0) {
          const invalidIds = invalidUsers.map(u => u.id);
          throw new BadRequestException(`Users not in creator's company: ${invalidIds.join(', ')}`);
        }
      } else {
        // If creator has no company, they can only add themselves (solo workspace)
        throw new BadRequestException('Solo users cannot add other members to their workspaces');
      }

      return true;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to validate membership eligibility: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new BadRequestException('Failed to validate user eligibility');
    }
  }

  /**
   * Get all members of a workspace
   */
  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDto[]> {
    try {
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId },
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
      });

      return members.map(member => ({
        id: member.id,
        userId: member.userId,
        workspaceId: member.workspaceId,
        role: member.role,
        user: member.user,
      }));
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get workspace members for ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new BadRequestException('Failed to get workspace members');
    }
  }

  /**
   * Check if a user is a member of a workspace
   */
  async isUserMemberOfWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const member = await this.prisma.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId,
        },
      });

      return !!member;
    } catch (error: unknown) {
      this.logger.error(
        `Failed to check membership for user ${userId} in workspace ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return false;
    }
  }

  /**
   * Get all workspaces where user is a member
   */
  async getUserWorkspaces(userId: string): Promise<string[]> {
    try {
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });

      return memberships.map(m => m.workspaceId);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user workspaces for ${userId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return [];
    }
  }

  /**
   * Add creator as admin member to workspace
   */
  async addCreatorAsAdmin(workspaceId: string, creatorId: string): Promise<void> {
    try {
      await this.prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: creatorId,
          role: MEMBER_ROLES.ADMIN,
        },
      });

      this.logger.log(`Added creator ${creatorId} as admin to workspace ${workspaceId}`);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to add creator as admin to workspace ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      throw new BadRequestException('Failed to add creator as workspace admin');
    }
  }

  /**
   * Get member count for a workspace
   */
  async getWorkspaceMemberCount(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.workspaceMember.count({
        where: { workspaceId },
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get member count for workspace ${workspaceId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return 0;
    }
  }

  /**
   * Get user company information
   */
  async getUserCompanyInfo(userId: string): Promise<{ companyId: string | null }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });

      return { companyId: user?.companyId || null };
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get user company info for ${userId}: ${getErrorMessage(error)}`,
        getErrorStack(error),
      );
      return { companyId: null };
    }
  }
}
