import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RatingsController } from './ratings.controller.js';
import { RatingService } from './services/rating.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RatingsController],
  providers: [RatingService],
})
export class RatingsModule {}
