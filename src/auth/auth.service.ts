import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcrypt";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DRIZZLE_DB } from "../db/db.module";
import * as schema from "../db/schema";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { UserRole } from "./dto/user-role.enum";
import { AuthTokens } from "./types/auth-tokens";
import { JwtPayload } from "./types/jwt-payload";
import { AuthUser } from "./types/auth-user";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  async register(payload: RegisterDto): Promise<AuthTokens> {
    if (![UserRole.CLIENT, UserRole.GROOMER_OWNER].includes(payload.role)) {
      throw new BadRequestException("Role not allowed for registration.");
    }

    const email = payload.email.toLowerCase();
    const existing = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (existing.length > 0) {
      throw new BadRequestException("Email already registered.");
    }

    if (payload.role === UserRole.GROOMER_OWNER && !payload.password) {
      throw new BadRequestException("Password is required for groomers.");
    }

    const password = payload.password ?? this.generateRandomPassword();
    const passwordHash = await hash(password, 10);
    const [user] = await this.db
      .insert(schema.users)
      .values({
        email,
        passwordHash,
        role: payload.role,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      });

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async login(payload: LoginDto): Promise<AuthTokens> {
    const email = payload.email.toLowerCase();
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email));

    if (!user) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const isValid = await compare(payload.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async loginLite(email: string, password?: string): Promise<AuthTokens> {
    const normalizedEmail = email.toLowerCase();
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (!user) {
      return this.clientLogin(normalizedEmail);
    }

    if (user.role === UserRole.CLIENT) {
      return this.issueTokens(user.id, user.email, user.role as UserRole);
    }

    if (!password) {
      throw new UnauthorizedException("Password is required for this account.");
    }

    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    return this.issueTokens(user.id, user.email, user.role as UserRole);
  }

  async clientLogin(email: string): Promise<AuthTokens> {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail));

    if (existing[0]) {
      if (existing[0].role !== UserRole.CLIENT) {
        throw new UnauthorizedException(
          "Email is registered as a non-client user.",
        );
      }
      return this.issueTokens(
        existing[0].id,
        existing[0].email,
        existing[0].role as UserRole,
      );
    }

    const passwordHash = await hash(this.generateRandomPassword(), 10);
    const [created] = await this.db
      .insert(schema.users)
      .values({
        email: normalizedEmail,
        passwordHash,
        role: UserRole.CLIENT,
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
      });

    return this.issueTokens(created.id, created.email, created.role as UserRole);
  }

  async refresh(payload: RefreshDto): Promise<AuthTokens> {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(payload.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || "change_me_too",
      });
      if (decoded.tokenType !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token.");
      }
      return this.issueTokens(decoded.sub, decoded.email, decoded.role);
    } catch {
      throw new UnauthorizedException("Invalid refresh token.");
    }
  }

  async me(user: AuthUser): Promise<AuthUser> {
    return user;
  }

  private issueTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): AuthTokens {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      tokenType: "access",
    };
    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      role,
      tokenType: "refresh",
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: process.env.JWT_ACCESS_SECRET || "change_me",
      expiresIn: "15m",
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: process.env.JWT_REFRESH_SECRET || "change_me_too",
      expiresIn: "30d",
    });

    return { accessToken, refreshToken };
  }

  private generateRandomPassword() {
    return randomBytes(16).toString("hex");
  }
}
