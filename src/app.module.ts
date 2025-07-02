import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './aws/upload/upload.module';
import { CompanyModule } from './company/company.module';
import { WorkspaceModule } from './workspace/workspace.module';

@Module({
  imports: [UserModule, ConfigModule.forRoot({ isGlobal: true }), UploadModule, CompanyModule, WorkspaceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
