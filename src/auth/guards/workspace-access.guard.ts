import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_ROLES } from 'src/common/constants/enums';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.types';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const workspaceId = request.params?.id;
    const method = request.method;

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

    // Get the workspace with creator info
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        creatorId: true,
        members: {
          where: {
            userId: user.sub,
          },
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Check if user is a member of the workspace
    const membership = workspace.members.find(member => member.userId === user.sub);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    // For edit/delete operations (PATCH, PUT, DELETE), only the creator can perform these actions
    const isModifyingOperation = ['PATCH', 'PUT', 'DELETE'].includes(method);
    if (isModifyingOperation) {
      if (workspace.creatorId !== user.sub) {
        throw new ForbiddenException('Only workspace creator can perform this action');
      }
    }

    // For read operations (GET), any member can access
    return true;
  }
}
