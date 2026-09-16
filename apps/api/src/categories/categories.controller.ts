import { Controller, Get, Logger } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

/** Handles HTTP routes for categories - public endpoint for dropdowns */
@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Gets all categories in hierarchical structure
   * Public endpoint - anyone can view categories
   * Returns root categories with their children nested
   */
  @Get()
  async getAllCategories() {
    try {
      this.logger.log('Fetching all categories');
      const categories = await this.categoriesService.getAllCategories();
      return {
        success: true,
        categories,
      };
    } catch (error) {
      this.logger.error('Failed to fetch categories', error);
      throw error;
    }
  }
}
