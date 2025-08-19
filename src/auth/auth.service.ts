import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { jwtConstants } from './constants';
import { UserService } from 'src/user/user.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { USER_TYPES } from 'src/common/constants/enums';

interface RefreshTokenPayload {
  sub: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private userService: UserService,
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

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userType = this.determineUserType(user);

    return this.signToken(user.id, user.email, user.role, user.name, userType);
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

      return this.signToken(user.id, user.email, user.role, user.name, userType);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
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
      user: { id: userId, name, email, role, userType },
    };
  }
}
