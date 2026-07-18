import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'The Google ID token (JWT credential) obtained on the client from Google Identity Services',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
