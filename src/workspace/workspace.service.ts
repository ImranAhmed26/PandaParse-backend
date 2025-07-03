import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateWorkspaceDto, userId: string) {
    return this.prisma.workspace.create({
      data: {
        name: data.name,
        userId,
        companyId: data.companyId,
      },
    });
  }

  findAll() {
    return this.prisma.workspace.findMany({
      include: { documents: true },
    });
  }

  findOne(id: string) {
    return this.prisma.workspace.findUnique({
      where: { id },
      include: { documents: true },
    });
  }

  update(id: string, data: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.workspace.delete({
      where: { id },
    });
  }
}
