import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gets all categories in hierarchical structure
   * Returns root categories with their children nested
   */
  async getAllCategories() {
    this.logger.log('[START] Fetching all categories from database');
    
    try {
      this.logger.debug('[QUERY] Executing Prisma query to find active categories with children');
      
      const categories = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }],
        include: {
          children: {
            where: { isActive: true },
            orderBy: [{ sort: 'asc' }, { nameEn: 'asc' }],
          },
        },
      });

      this.logger.debug(`[RESULT] Retrieved ${categories.length} total categories from database`);

      // Return only root categories (those without parentId)
      const rootCategories = categories.filter((cat) => !cat.parentId);

      this.logger.log(`[SUCCESS] Successfully retrieved ${rootCategories.length} root categories with hierarchical structure`);
      this.logger.debug(`[DETAIL] Root categories: ${rootCategories.map(c => `${c.nameEn} (${c.id})`).join(', ')}`);
      
      return rootCategories;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to fetch categories from database - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to retrieve categories at this time. Please try again later.');
    }
  }
}
