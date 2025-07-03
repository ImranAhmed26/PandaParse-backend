import { IsEmail, IsNotEmpty, IsString, Matches, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{10,}$/, {
    message:
      'Password must be at least 10 characters long and include uppercase, lowercase, number, and special character',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
