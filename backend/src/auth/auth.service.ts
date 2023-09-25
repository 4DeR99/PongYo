import { Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from './auth.constants';
import { JwtAuthPayload } from './interfaces/jwt.interface';
import { RedisService } from '@/redis/redis.service';

@Injectable()
export class AuthService {
  private prisma: PrismaClient;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async fortyTwoCallback(user: User, res: Response) {
    const payload = {
      iss: 'Transcendence',
      login: user.login,
      sub: user.login,
    } satisfies JwtAuthPayload;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: Math.ceil(AUTH_COOKIE_MAX_AGE),
    });

    res.cookie(AUTH_COOKIE_NAME, `Bearer ${accessToken}`, {
      httpOnly: true,
      path: '/',
      maxAge: Math.ceil(AUTH_COOKIE_MAX_AGE * 1e3),
    });
    res.redirect(this.configService.get('FRONTEND_ORIGIN'));
  }

  async logout(req: Request, res: Response) {
    const accessToken = req.cookies[AUTH_COOKIE_NAME];

    const payload = await this.jwtService.verifyAsync<JwtAuthPayload>(
      accessToken,
      {
        secret: this.configService.get('JWT_SECRET'),
      },
    );

    const ex = Math.ceil(payload.exp - Date.now() / 1000);
    await this.redisService.set(accessToken, payload.login, 'EX', ex);
    res.clearCookie(AUTH_COOKIE_NAME, {
      httpOnly: true,
      expires: new Date(1970), // magic trick !
    });
    res.redirect(this.configService.get('FRONTEND_ORIGIN'));
  }
}