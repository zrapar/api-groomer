import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { ClientLoginDto } from "./dto/client-login.dto";
import { AuthUser } from "./types/auth-user";

@Controller("api/v1/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post("login")
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post("client-login")
  clientLogin(@Body() payload: ClientLoginDto) {
    return this.authService.clientLogin(payload.email);
  }

  @Post("refresh")
  refresh(@Body() payload: RefreshDto) {
    return this.authService.refresh(payload);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return this.authService.me(req.user);
  }
}
