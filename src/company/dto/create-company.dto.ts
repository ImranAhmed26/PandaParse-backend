import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  name!: string;
}
