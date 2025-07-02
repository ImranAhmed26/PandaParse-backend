import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserCreateDto } from './dto/user-create.dto';
import { UserUpdateDto } from './dto/user-update.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async create(userCreateDto: UserCreateDto) {
    return this.prisma.user.create({
      data: { ...userCreateDto },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { documents: true, workspace: true, jobs: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
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
