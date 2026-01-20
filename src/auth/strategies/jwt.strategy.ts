import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "../types/jwt-payload";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET || "change_me",
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.tokenType !== "access") {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
