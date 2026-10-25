import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { RatingService, type RatingResponse } from './services/rating.service.js';

@Controller('ratings')
export class RatingsController {
  private readonly logger = new Logger(RatingsController.name);

  constructor(private readonly ratingService: RatingService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createRating(
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: TokenPayload,
  ): Promise<{ success: true; data: RatingResponse }> {
    this.logger.log(`[REQUEST] POST /ratings - userId=${user.sub}, reservationId=${dto.reservationId}`);
    const data = await this.ratingService.createRating(user.sub, dto);
    this.logger.log(`[RESPONSE] POST /ratings - ratingId=${data.id}`);
    return { success: true, data };
  }
}
