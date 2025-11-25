import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter';
import { AuthService } from '@/business/services/auth.service';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
    constructor(private readonly authService: AuthService) {
        super({
            consumerKey: process.env.TWITTER_CONSUMER_KEY,
            consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
            callbackURL: process.env.TWITTER_CALLBACK_URL,
        });
        console.log('🐦 TwitterStrategy initialized with Callback URL:', process.env.TWITTER_CALLBACK_URL);
    }

    async validate(
        token: string,
        tokenSecret: string,
        profile: any,
        done: (err: any, user: any, info?: any) => void,
    ): Promise<any> {
        try {
            const user = await this.authService.validateUser(profile);
            done(null, user);
        } catch (error) {
            done(error, false);
        }
    }
}
