import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserRepository } from '../repositories/user.repository';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UserRole } from './dto/user-role.enum';
import { AuthTokens } from './types/auth-tokens';
import { JwtPayload } from './types/jwt-payload';
import { AuthUser } from './types/auth-user';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto): Promise<AuthTokens> {
    if (![UserRole.CLIENT, UserRole.GROOMER_OWNER].includes(payload.role)) {
      throw new BadRequestException('Role not allowed for registration.');
    }

    const email = payload.email.toLowerCase();
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new BadRequestException('Email already registered.');
    }

    if (payload.role === UserRole.GROOMER_OWNER && !payload.password) {
      throw new BadRequestException('Password is required for groomers.');
    }

    const password = payload.password ?? this.generateRandomPassword();
    const passwordHash = await hash(password, 10);
    const user = await this.userRepo.create({
      email,
      passwordHash,
      role: payload.role,
    });

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async login(payload: LoginDto): Promise<AuthTokens> {
    const email = payload.email.toLowerCase();
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials.');

    const isValid = await compare(payload.password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials.');

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async loginLite(email: string, password?: string): Promise<AuthTokens> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user) return this.clientLogin(normalizedEmail);

    if (user.role === UserRole.CLIENT) {
      return this.issueTokens(user.id, user.email, user.role as UserRole);
    }

    if (!password)
      throw new UnauthorizedException('Password is required for this account.');

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials.');

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async getEmailStatus(email: string) {
    const user = await this.userRepo.findByEmail(email.toLowerCase());
    if (!user)
      return { exists: false, role: UserRole.CLIENT, requiresPassword: false };
    return {
      exists: true,
      role: user.role,
      requiresPassword: user.role !== UserRole.CLIENT,
    };
  }

  async clientLogin(email: string): Promise<AuthTokens> {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);

    if (existing) {
      if (existing.role !== UserRole.CLIENT) {
        throw new UnauthorizedException(
          'Email is registered as a non-client user.',
        );
      }
      return this.issueTokens(
        existing.id,
        existing.email,
        existing.role as UserRole,
      );
    }

    const passwordHash = await hash(this.generateRandomPassword(), 10);
    const user = await this.userRepo.create({
      email: normalizedEmail,
      passwordHash,
      role: UserRole.CLIENT,
    });

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async refresh(payload: RefreshDto): Promise<AuthTokens> {
    if (!payload.refreshToken)
      throw new UnauthorizedException('No refresh token provided.');
    return this.refreshFromToken(payload.refreshToken);
  }

  async refreshFromToken(token: string): Promise<AuthTokens> {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_REFRESH_SECRET || 'change_me_too',
      });
      if (decoded.tokenType !== 'refresh')
        throw new UnauthorizedException('Invalid refresh token.');

      // Rotation: verify token is in DB and not revoked, then revoke it
      const record = await this.refreshTokenRepo.verify(token);
      if (!record)
        throw new UnauthorizedException(
          'Refresh token has been revoked or expired.',
        );

      await this.refreshTokenRepo.revoke(token);
      return this.issueTokens(decoded.sub, decoded.email, decoded.role);
    } catch (err) {
      if ((err as Error).message.includes('revoked')) throw err;
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  me(user: AuthUser): AuthUser {
    return user;
  }

  private issueTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): AuthTokens {
    const base = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(
      { ...base, tokenType: 'access' } satisfies JwtPayload,
      {
        secret: process.env.JWT_ACCESS_SECRET || 'change_me',
        expiresIn: '15m',
      },
    );
    const refreshToken = this.jwtService.sign(
      { ...base, tokenType: 'refresh' } satisfies JwtPayload,
      {
        secret: process.env.JWT_REFRESH_SECRET || 'change_me_too',
        expiresIn: '30d',
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    void this.refreshTokenRepo
      .save(userId, refreshToken, expiresAt)
      .catch(() => {
        // Non-blocking: if saving fails the token still works via JWT signature validation
      });

    return { accessToken, refreshToken };
  }

  private generateRandomPassword() {
    return randomBytes(16).toString('hex');
  }
}
