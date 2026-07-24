import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { LoginRequest, LoginResponse, MeResponse } from "@gulio/contracts";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import type { RequestUser } from "./types/request-user";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    if (!body?.email || !body?.password) {
      throw new UnauthorizedException("Email and password are required");
    }
    return this.authService.login(body.email, body.password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser): Promise<MeResponse> {
    return this.authService.me(user.userId);
  }
}
