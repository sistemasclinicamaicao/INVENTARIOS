import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
