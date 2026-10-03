import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
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
    this.logger.log('[START] Fetching all locations from database');
    
    try {
      this.logger.debug('[QUERY] Executing Prisma query to find locations with hierarchical children');
      
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

      this.logger.debug(`[RESULT] Retrieved ${locations.length} total locations from database`);

      // Return only root locations (those without parentId - regions)
      const rootLocations = locations.filter((loc) => !loc.parentId);

      this.logger.log(`[SUCCESS] Successfully retrieved ${rootLocations.length} root locations (regions) with hierarchical structure`);
      this.logger.debug(`[DETAIL] Root regions: ${rootLocations.map(l => `${l.nameEn} (${l.id})`).join(', ')}`);
      
      return rootLocations;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to fetch locations from database - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException('Unable to retrieve locations at this time. Please try again later.');
    }
  }

  /**
   * Gets locations by type (REGION, CITY, SUBCITY)
   * Useful for dropdowns that only need specific location types
   */
  async getLocationsByType(type: LocationType) {
    this.logger.log(`[START] Fetching locations by type: ${type}`);
    
    try {
      this.logger.debug(`[QUERY] Executing Prisma query to find locations with type=${type}`);
      
      const locations = await this.prisma.location.findMany({
        where: { type },
        orderBy: [{ nameEn: 'asc' }],
      });

      this.logger.log(`[SUCCESS] Successfully retrieved ${locations.length} locations of type ${type}`);
      this.logger.debug(`[DETAIL] Locations: ${locations.map(l => `${l.nameEn} (${l.id})`).join(', ')}`);
      
      return locations;
    } catch (error) {
      this.logger.error(`[ERROR] Failed to fetch locations by type ${type} - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw new InternalServerErrorException(`Unable to retrieve locations of type ${type} at this time. Please try again later.`);
    }
  }
}
