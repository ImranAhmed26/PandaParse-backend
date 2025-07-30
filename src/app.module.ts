import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './aws/upload/upload.module';
import { CompanyModule } from './company/company.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { DocumentModule } from './document/document.module';
import { JobModule } from './job/job.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    UserModule,
    ConfigModule.forRoot({ isGlobal: true }),
    UploadModule,
    CompanyModule,
    WorkspaceModule,
    DocumentModule,
    JobModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
