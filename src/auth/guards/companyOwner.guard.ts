import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class CompanyOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.id;

    if (!user || !companyId) return false;

    // ✅ Admins bypass access check
    if (user.role === UserRole.ADMIN) return true;

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { companyId: true },
    });

    if (!userRecord) throw new ForbiddenException('User not found');

    // ✅ Check if user's company matches
    if (userRecord.companyId !== companyId) {
      throw new ForbiddenException('Access denied: not company owner');
    }

    return true;
  }
}
