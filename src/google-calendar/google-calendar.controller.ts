import { Controller, Get, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { GoogleCalendarService } from "./google-calendar.service";

@Controller("api/v1/google-calendar")
export class GoogleCalendarController {
  constructor(private readonly service: GoogleCalendarService) {}

  @Get("oauth-url")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GROOMER_OWNER)
  async getOauthUrl(@Req() req: { user: AuthUser }) {
    const url = await this.service.getAuthUrl(req.user.id);
    return { url };
  }

  @Get("callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const frontendBase = process.env.FRONTEND_BASE_URL || "http://localhost:8080";
    if (!code || !state) {
      return res.redirect(`${frontendBase}/groomer/settings?google=error`);
    }
    try {
      await this.service.handleCallback(code, state);
      return res.redirect(`${frontendBase}/groomer/settings?google=connected`);
    } catch {
      return res.redirect(`${frontendBase}/groomer/settings?google=error`);
    }
  }

  @Get("status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GROOMER_OWNER)
  getStatus(@Req() req: { user: AuthUser }) {
    return this.service.getStatus(req.user.id);
  }

  @Post("disconnect")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.GROOMER_OWNER)
  async disconnect(@Req() req: { user: AuthUser }) {
    await this.service.disconnect(req.user.id);
    return { ok: true };
  }
}
