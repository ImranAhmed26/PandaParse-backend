import { Module, forwardRef } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyModule } from 'src/company/company.module';

@Module({
  imports: [PrismaModule, forwardRef(() => CompanyModule)],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
