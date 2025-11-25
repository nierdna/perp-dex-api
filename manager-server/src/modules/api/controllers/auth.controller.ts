import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '@/business/services/auth.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Get('twitter')
    @UseGuards(AuthGuard('twitter'))
    @ApiOperation({ summary: 'Login with Twitter' })
    async twitterLogin() {
        // Initiates the Twitter OAuth flow
    }

    @Get('twitter/callback')
    @UseGuards(AuthGuard('twitter'))
    @ApiOperation({ summary: 'Twitter Login Callback' })
    async twitterLoginCallback(@Req() req, @Res() res) {
        // Handles the callback from Twitter
        const jwt = await this.authService.login(req.user);
        // Redirect to UI with token
        res.redirect(`${process.env.UI_URL}/auth/callback?token=${jwt.accessToken}`);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user info' })
    async getMe(@Req() req) {
        return this.authService.getUserInfo(req.user.userId);
    }
}
