import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ClientLoginDto } from './dto/client-login.dto';
import { LoginLiteDto } from './dto/login-lite.dto';
import { EmailStatusDto } from './dto/email-status.dto';
import { AuthUser } from './types/auth-user';
import { AuthTokens } from './types/auth-tokens';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() payload: RegisterDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const tokens = await this.authService.register(payload);
    this.setTokenCookies(res as Response, tokens);
    return tokens;
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() payload: LoginDto, @Res({ passthrough: true }) res: any) {
    const tokens = await this.authService.login(payload);
    this.setTokenCookies(res as Response, tokens);
    return tokens;
  }

  @Post('login-lite')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async loginLite(
    @Body() payload: LoginLiteDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const tokens = await this.authService.loginLite(
      payload.email,
      payload.password,
    );
    this.setTokenCookies(res as Response, tokens);
    return tokens;
  }

  @Post('email-status')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  emailStatus(@Body() payload: EmailStatusDto) {
    return this.authService.getEmailStatus(payload.email);
  }

  @Post('client-login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async clientLogin(
    @Body() payload: ClientLoginDto,
    @Res({ passthrough: true }) res: any,
  ) {
    const tokens = await this.authService.clientLogin(payload.email);
    this.setTokenCookies(res as Response, tokens);
    return tokens;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(
    @Body() payload: RefreshDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const cookieToken = (req as Request).cookies?.refresh_token as
      | string
      | undefined;
    const tokens = cookieToken
      ? await this.authService.refreshFromToken(cookieToken)
      : await this.authService.refresh(payload);
    this.setTokenCookies(res as Response, tokens);
    return tokens;
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: any) {
    (res as Response).clearCookie('access_token', COOKIE_OPTIONS);
    (res as Response).clearCookie('refresh_token', {
      ...COOKIE_OPTIONS,
      path: '/',
    });
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return this.authService.me(req.user);
  }

  private setTokenCookies(res: Response, tokens: AuthTokens) {
    res.cookie('access_token', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
