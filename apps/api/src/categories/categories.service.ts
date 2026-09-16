import { Injectable, Logger } from '@nestjs/common';
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
    try {
      this.logger.log('Fetching all categories');

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

      // Return only root categories (those without parentId)
      const rootCategories = categories.filter((cat) => !cat.parentId);

      this.logger.log(`Found ${rootCategories.length} root categories`);
      return rootCategories;
    } catch (error) {
      this.logger.error('Failed to fetch categories', error);
      throw error;
    }
  }
}
