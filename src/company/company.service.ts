import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateCompanyDto, userId: string) {
    return this.prisma.company.create({
      data: {
        name: data.name,
        users: {
          connect: {
            id: userId,
          },
        },
        ownerId: userId,
      },
    });
  }

  findAll(userId: string) {
    return this.prisma.company.findMany({
      where: {
        ownerId: userId,
      },
      include: { users: true },
    });
  }

  findOne(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: { users: true },
    });
  }

  update(id: string, data: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.company.delete({
      where: { id },
    });
  }
}
