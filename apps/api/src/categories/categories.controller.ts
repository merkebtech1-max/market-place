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
    this.logger.log('[REQUEST] GET /categories - Incoming request to fetch all categories');
    
    try {
      const categories = await this.categoriesService.getAllCategories();
      
      this.logger.log(`[RESPONSE] GET /categories - Successfully returned ${categories.length} categories`);
      return {
        success: true,
        categories,
      };
    } catch (error) {
      this.logger.error(`[ERROR] GET /categories - Request failed - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
