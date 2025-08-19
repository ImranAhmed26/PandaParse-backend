import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
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

    // For newly registered users, they start as individual freelancers
    const userType = USER_TYPES.INDIVIDUAL_FREELANCER;
    return this.signToken(user.id, user.email, user.role, user.name, userType);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    console.log('🔐 LOGIN DEBUG START ===================');
    console.log('📧 Email:', dto.email);
    console.log('🔑 Password provided:', !!dto.password);
    console.log('🔑 Password length:', dto.password?.length);
    console.log('🔑 Password value:', dto.password); // Remove this in production!

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: {
          ownedCompany: true,
          company: true,
        },
      });

      console.log('👤 User found in DB:', !!user);

      if (!user) {
        console.log('❌ User not found in database');
        throw new UnauthorizedException('Invalid credentials');
      }

      console.log('👤 User ID:', user.id);
      console.log('👤 User email:', user.email);
      console.log('👤 User name:', user.name);
      console.log('🔐 Stored hash exists:', !!user.password);
      console.log('🔐 Stored hash length:', user.password?.length);
      console.log('🔐 Hash starts with $2b$:', user.password?.startsWith('$2b$'));
      console.log('🔐 Hash starts with $2a$:', user.password?.startsWith('$2a$'));
      console.log('🔐 Hash preview:', user.password?.substring(0, 29) + '...');

      // Test bcrypt comparison
      console.log('🔍 Starting bcrypt comparison...');
      const passwordMatch = await bcrypt.compare(dto.password, user.password);
      console.log('✅ Bcrypt comparison result:', passwordMatch);

      if (!passwordMatch) {
        console.log('❌ PASSWORD MISMATCH DETAILS:');
        console.log('   - Input password:', dto.password);
        console.log('   - Stored hash:', user.password);
        console.log('   - Hash algorithm:', user.password?.substring(0, 4));

        // Try to create a new hash with the same password to compare
        const testHash = await bcrypt.hash(dto.password, 10);
        console.log('   - New hash for same password:', testHash);
        console.log('   - New hash matches input:', await bcrypt.compare(dto.password, testHash));

        console.log('🔐 LOGIN DEBUG END (FAILED) ===================');
        throw new UnauthorizedException('Invalid credentials');
      }

      console.log('✅ Password match successful!');

      const userType = this.determineUserType(user);
      console.log('👤 User type determined:', userType);

      const tokens = this.signToken(user.id, user.email, user.role, user.name, userType);
      console.log('🎫 Tokens generated successfully');
      console.log('🔐 LOGIN DEBUG END (SUCCESS) ===================');

      return tokens;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.log('💥 LOGIN ERROR:', error.message);
      console.log('🔐 LOGIN DEBUG END (ERROR) ===================');
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
        secret: jwtConstants.refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          ownedCompany: true,
          company: true,
        },
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

  private determineUserType(user: {
    ownedCompany?: any;
    company?: any;
    companyId?: string | null;
  }): number {
    // If user owns a company, they are a company owner
    if (user.ownedCompany) {
      return USER_TYPES.COMPANY_OWNER;
    }

    // If user belongs to a company but doesn't own it, they are a company user
    if (user.company || user.companyId) {
      return USER_TYPES.COMPANY_USER;
    }

    // Otherwise, they are an individual freelancer
    return USER_TYPES.INDIVIDUAL_FREELANCER;
  }

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
        userType,
      },
    };
  }
}
