import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class CompanyUserGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.id;

    if (!user || !companyId) return false;

    // ✅ Admins bypass access check
    if (user.role === UserRole.ADMIN) return true;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) throw new ForbiddenException('Company not found');

    // ✅ Check if user's company matches
    if (user.companyId !== company.id) {
      throw new ForbiddenException('Access denied: not your company');
    }

    return true;
  }
}
