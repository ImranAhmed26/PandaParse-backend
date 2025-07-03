import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class CompanyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.companyId || request.body.companyId;

    return !!user && !!companyId && user.companyId === companyId;
  }
}
