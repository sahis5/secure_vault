import { Controller, Get, Post, Body, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('auth')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health/live')
  livenessProbe() { return { status: 'alive' }; }

  @Get('health/ready')
  readinessProbe() { return { status: 'ready' }; }

  @Post('register')
  async register(@Body() body: { email: string; name: string; password: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    try {
      return await this.appService.register(body.email, body.name || body.email.split('@')[0], body.password);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    try {
      return await this.appService.login(body.email, body.password);
    } catch (e: any) {
      throw new UnauthorizedException(e.message);
    }
  }

  @Get('me')
  getMe(@Headers('authorization') auth: string) {
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token');
    }
    try {
      const user = this.appService.verifyToken(auth.slice(7));
      return { user };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
