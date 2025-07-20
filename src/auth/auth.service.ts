import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { jwtConstants } from './constants';
import { UserService } from 'src/user/user.service';
import { AuthResponseDto } from './dto/auth-response.dto';

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

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }
    if (!dto.name) {
      throw new BadRequestException('Name is required');
    }
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    console.log('hashedPassword', hashedPassword);
    const user = await this.userService.create({
      ...dto,
      password: hashedPassword,
    });

    return this.signToken(user.id, user.email, user.role, user.name);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken(user.id, user.email, user.role, user.name);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
        secret: jwtConstants.refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
        },
      });
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return this.signToken(user.id, user.email, user.role, user.name);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private signToken(userId: string, email: string, role: string, name: string): AuthResponseDto {
    const payload = { sub: userId, email, role };

    return {
      access_token: this.jwt.sign(payload, {
        secret: jwtConstants.accessSecret,
        expiresIn: '15m',
      }),
      refresh_token: this.jwt.sign(
        { sub: userId },
        {
          secret: jwtConstants.refreshSecret,
          expiresIn: '7d',
        },
      ),
      user: {
        id: userId,
        name,
        email,
        role,
      },
    };
  }
}
