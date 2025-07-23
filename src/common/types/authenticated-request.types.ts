// src/common/types/authenticated-request.type.ts
import { Request } from 'express';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload & { companyId?: string }; // whatever your JWT strategy returns
}
