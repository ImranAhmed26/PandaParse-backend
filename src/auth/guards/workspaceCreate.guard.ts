import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_ROLES } from 'src/common/constants/enums';
import { AuthenticatedRequest } from 'src/common/types/authenticated-request.types';

@Injectable()
export class WorkspaceCreateGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) throw new ForbiddenException('User not authenticated');

    // ✅ Admins can always create
    if (user.role === USER_ROLES.ADMIN) return true;

    // ✅ If user does NOT belong to a company → allowed
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { companyId: true },
    });

    if (!userRecord) throw new ForbiddenException('User not found');

    if (!userRecord.companyId) return true;

    // ✅ If user belongs to a company, only owner can create
    const company = await this.prisma.company.findUnique({
      where: { id: userRecord.companyId },
      select: { ownerId: true },
    });

    if (!company) throw new ForbiddenException('Company not found');

    if (company.ownerId !== user.sub) {
      throw new ForbiddenException('Only company owners can create workspaces');
    }

    return true;
  }
}
