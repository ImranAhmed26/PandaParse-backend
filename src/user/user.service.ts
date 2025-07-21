import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserUpdateDto } from './dto/user-update.dto';
import { CompanyService } from 'src/company/company.service';
import { USER_ROLES } from 'src/common/constants/enums';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private companyService: CompanyService,
  ) {}

  async create(userCreateDto: UserCreateDto) {
    const { companyName, ...userData } = userCreateDto;
    return await this.prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          ...userData,
          role: userData.role ?? USER_ROLES.USER,
        },
      });

      if (companyName) {
        const company = await this.companyService.create({ name: companyName }, user.id, tx);

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: { companyId: company.id },
        });

        // const company = await tx.company.create({
        //   data: {
        //     name: companyName,
        //     users: {
        //       connect: {
        //         id: user.id,
        //       },
        //     },
        //     ownerId: user.id,
        //   },
        // });

        return updatedUser;
      }

      return user;
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { documents: true, jobs: true, tokens: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { tokens: true },
    });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);
    return user;
  }

  async update(id: string, userUpdateDto: UserUpdateDto) {
    return this.prisma.user.update({ where: { id }, data: userUpdateDto });
  }

  async delete(id: string) {
    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }
}
