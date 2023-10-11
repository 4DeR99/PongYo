import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { FortyTwoGuard } from './guards/42.guard';
import { JwtAuthGuard } from './guards/jwt.guard';
import { AccessToken } from './auth.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('42')
  @UseGuards(FortyTwoGuard)
  fortyTwoLogin() {
    // ? INFO: this function will redirect to intra login page !
  }

  @Get('42/callback')
  @UseGuards(FortyTwoGuard)
  async fortyTwoCallback(@Req() req: Request, @Res() res: Response) {
    this.authService.fortyTwoCallback(req.user, res);
  }
  @Get('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@AccessToken() accessToken: string, @Res() res: Response) {
    // this.authService.logout(accessToken, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return req.user;
  }
}
