import { CanActivate, ExecutionContext, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_ROLES, OWNER_TYPES } from 'src/common/constants/enums';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.types';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const workspaceId = request.params?.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Admins can access any workspace
    if (user.role === USER_ROLES.ADMIN) {
      return true;
    }

    if (!workspaceId) {
      throw new ForbiddenException('Workspace ID is required');
    }

    // Get the workspace
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        ownerId: true,
        ownerType: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

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

    // Check access based on owner type
    if (workspace.ownerType === OWNER_TYPES.USER) {
      // User-owned workspace: only the owner can access
      return workspace.ownerId === user.sub;
    } else if (workspace.ownerType === OWNER_TYPES.COMPANY) {
      // Company-owned workspace: any user in the company can access
      return userRecord.companyId === workspace.ownerId;
    }

    return false;
  }
}