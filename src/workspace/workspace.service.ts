import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { OWNER_TYPES, USER_ROLES } from 'src/common/constants/enums';
import { JwtPayload } from 'src/auth/interfaces/jwt-payload.interfaces';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}
  private logger = new Logger(WorkspaceService.name);

  // create(data: CreateWorkspaceDto, userId: string) {
  //   return this.prisma.workspace.create({
  //     data: {
  //       name: data.name,
  //       ownerId: userId,
  //       ownerType: data.ownerType ?? OWNER_TYPES.USER,
  //     },
  //   });
  // }

  async create(data: CreateWorkspaceDto, user: JwtPayload) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { companyId: true },
    });
    this.logger.log('userRecord', userRecord);

    if (!userRecord) {
      throw new ForbiddenException('User not found');
    }

    // ✅ Determine ownerType & ownerId
    type OwnerType = (typeof OWNER_TYPES)[keyof typeof OWNER_TYPES];
    let ownerType: OwnerType = OWNER_TYPES.USER;
    let ownerId = user.sub;

    if (userRecord.companyId && user.role !== USER_ROLES.ADMIN) {
      ownerType = OWNER_TYPES.COMPANY;
      ownerId = userRecord.companyId;
    }

    try {
      return await this.prisma.workspace.create({
        data: {
          name: data.name,
          ownerId,
          ownerType,
          creatorId: user.sub, // track who actually created it
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            `A workspace with the name "${data.name}" already exists in your records.`,
          );
        }
      }
      throw new InternalServerErrorException('Something went wrong, please try again later.');
    }
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
