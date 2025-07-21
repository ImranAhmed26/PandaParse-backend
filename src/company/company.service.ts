import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateCompanyDto, userId: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.company.create({
      data: {
        name: data.name,
        ownerId: userId,
        users: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      include: { users: true, tokens: true },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { users: true, tokens: true },
    });
    if (!company) throw new NotFoundException(`Company with ID ${id} not found`);
    return company;
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
