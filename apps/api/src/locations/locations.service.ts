import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocationType } from '../generated/prisma/enums.js';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Gets all locations in hierarchical structure
   * Returns regions with their cities and subcities nested
   */
  async getAllLocations() {
    try {
      this.logger.log('Fetching all locations');

      const locations = await this.prisma.location.findMany({
        orderBy: [{ nameEn: 'asc' }],
        include: {
          children: {
            orderBy: [{ nameEn: 'asc' }],
            include: {
              children: {
                orderBy: [{ nameEn: 'asc' }],
              },
            },
          },
        },
      });

      // Return only root locations (those without parentId - regions)
      const rootLocations = locations.filter((loc) => !loc.parentId);

      this.logger.log(`Found ${rootLocations.length} root locations (regions)`);
      return rootLocations;
    } catch (error) {
      this.logger.error('Failed to fetch locations', error);
      throw error;
    }
  }

  /**
   * Gets locations by type (REGION, CITY, SUBCITY)
   * Useful for dropdowns that only need specific location types
   */
  async getLocationsByType(type: LocationType) {
    try {
      this.logger.log(`Fetching locations by type: ${type}`);

      const locations = await this.prisma.location.findMany({
        where: { type },
        orderBy: [{ nameEn: 'asc' }],
      });

      this.logger.log(`Found ${locations.length} locations of type ${type}`);
      return locations;
    } catch (error) {
      this.logger.error(`Failed to fetch locations by type ${type}`, error);
      throw error;
    }
  }
}
