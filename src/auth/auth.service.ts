import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import { UserService } from 'src/user/user.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { USER_ROLES, USER_TYPES } from 'src/common/constants/enums';

interface RefreshTokenPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  private googleClient?: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private userService: UserService,
    private config: ConfigService,
  ) {}

  /** User registration */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    if (!dto.name) throw new BadRequestException('Name is required');
    if (!dto.password) throw new BadRequestException('Password is required');

    const user = await this.userService.create({ ...dto });
    const userType = USER_TYPES.INDIVIDUAL_FREELANCER;

    return this.signToken(user.id, user.email, user.role, user.name, userType);
  }

  /** User login */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { ownedCompany: true, company: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Accounts created via Google have no password — they must use "Sign in with Google".
    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Please continue with Google.',
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userType = this.determineUserType(user);

    return this.signToken(
      user.id,
      user.email,
      user.role,
      user.name,
      userType,
      user.image,
      user.emailVerified,
    );
  }

  /**
   * Google sign-in / sign-up.
   *
   * Verifies the Google ID token, then finds-or-creates the user by email:
   * - New email  -> create a Google-only account (no password, verified, picture set).
   * - Existing email registered with a password -> link it (set googleId, backfill the
   *   picture only if missing, mark verified) so the user is never duplicated.
   * - Already linked -> just sign in.
   */
  async googleLogin(idToken: string): Promise<AuthResponseDto> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new InternalServerErrorException('Google sign-in is not configured');
    }

    let payload: TokenPayload | undefined;
    try {
      const client = this.getGoogleClient(clientId);
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.email) {
      throw new UnauthorizedException('Google account did not provide an email');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const picture = payload.picture ?? null;
    const name = payload.name?.trim() || email.split('@')[0];

    const existing = await this.prisma.user.findUnique({
      where: { email },
      include: { ownedCompany: true, company: true },
    });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          // Keep an already-linked googleId and a user-set picture; never overwrite the name.
          data: {
            googleId: existing.googleId ?? googleId,
            image: existing.image ?? picture,
            emailVerified: true,
          },
          include: { ownedCompany: true, company: true },
        })
      : await this.prisma.user.create({
          data: {
            email,
            name,
            googleId,
            image: picture,
            emailVerified: true,
            role: USER_ROLES.USER,
          },
          include: { ownedCompany: true, company: true },
        });

    const userType = this.determineUserType(user);

    return this.signToken(
      user.id,
      user.email,
      user.role,
      user.name,
      userType,
      user.image,
      user.emailVerified,
    );
  }

  /** Refresh token logic */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
        secret: jwtConstants.refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { ownedCompany: true, company: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const userType = this.determineUserType(user);

      return this.signToken(
        user.id,
        user.email,
        user.role,
        user.name,
        userType,
        user.image,
        user.emailVerified,
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /** Lazily create (and cache) the Google OAuth client used to verify ID tokens. */
  private getGoogleClient(clientId: string): OAuth2Client {
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(clientId);
    }
    return this.googleClient;
  }

  /** Determines user type (company owner, company user, freelancer) */
  private determineUserType(user: {
    ownedCompany?: any;
    company?: any;
    companyId?: string | null;
  }): number {
    if (user.ownedCompany) return USER_TYPES.COMPANY_OWNER;
    if (user.company || user.companyId) return USER_TYPES.COMPANY_USER;
    return USER_TYPES.INDIVIDUAL_FREELANCER;
  }

  /** Generates JWT access & refresh tokens */
  private signToken(
    userId: string,
    email: string,
    role: number,
    name: string,
    userType: number,
    image?: string | null,
    emailVerified?: boolean,
  ): AuthResponseDto {
    const payload = { sub: userId, email, role };

    return {
      access_token: this.jwt.sign(payload, {
        secret: jwtConstants.accessSecret,
        expiresIn: '45m',
      }),
      refresh_token: this.jwt.sign({ sub: userId }, {
        secret: jwtConstants.refreshSecret,
        expiresIn: '7d',
      }),
      user: { id: userId, name, email, role, userType, image, emailVerified },
    };
  }
}
