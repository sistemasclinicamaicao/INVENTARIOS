import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { RbacService } from './rbac.service';
import { OtpService } from './otp.service';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rbacService: RbacService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByCedula(dto.cedula.trim());
    if (!user) {
      throw new UnauthorizedException('Cédula o contraseña incorrectos');
    }

    const devPassword = this.config.get('DEV_DEFAULT_PASSWORD') ?? 'Admin123!';
    const hash = user.passwordHash;
    let valid = false;
    if (hash) {
      valid = await bcrypt.compare(dto.password, hash);
    } else if (this.config.get('NODE_ENV') !== 'production') {
      valid = dto.password === devPassword;
    }
    if (!valid) {
      throw new UnauthorizedException('Cédula o contraseña incorrectos');
    }

    const otp = await this.otpService.generateAndStore(user.id);
    await this.otpService.sendEmail(user.email, otp);

    const sessionToken = uuidv4();
    await this.otpService.storeSession(sessionToken, user.id);

    return {
      requiresOtp: true,
      sessionToken,
      message: 'OTP enviado al correo registrado',
      devOtp: this.config.get('SMTP_HOST') ? undefined : otp,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const userId = await this.otpService.getSessionUserId(dto.sessionToken);
    if (!userId) {
      throw new BadRequestException('Sesión expirada. Inicie sesión nuevamente.');
    }

    const devOtpBypass =
      this.config.get('NODE_ENV') !== 'production' && dto.otp === '000000';
    const valid = devOtpBypass || (await this.otpService.verify(userId, dto.otp));
    if (!valid) {
      throw new UnauthorizedException('OTP inválido o expirado');
    }

    await this.otpService.deleteSession(dto.sessionToken);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const roles = user.roles?.map((r) => r.code) ?? [];
    const permissions = await this.rbacService.getUserPermissions(user.id);
    const payload = { sub: user.id, cedula: user.cedula, roles };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        cedula: user.cedula,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; cedula: string; roles: string[] }>(
        refreshToken,
      );
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('Usuario no válido');
      const roles = user.roles?.map((r) => r.code) ?? [];
      const permissions = await this.rbacService.getUserPermissions(user.id);
      const newPayload = { sub: user.id, cedula: user.cedula, roles };
      return {
        accessToken: this.jwtService.sign(newPayload),
        permissions,
        roles,
      };
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
  }
}
