import { Controller, Get, Logger, Query } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import { LocationType } from '../generated/prisma/enums.js';

/** Handles HTTP routes for locations - public endpoint for dropdowns */
@Controller('locations')
export class LocationsController {
  private readonly logger = new Logger(LocationsController.name);

  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Gets all locations in hierarchical structure
   * Public endpoint - anyone can view locations
   * Returns regions with their cities and subcities nested
   * 
   * Query params:
   * - type: Optional filter by location type (REGION, CITY, SUBCITY)
   */
  @Get()
  async getLocations(@Query('type') type?: string) {
    try {
      // If type is provided, filter by type
      if (type) {
        // Validate the type is a valid LocationType enum
        if (!Object.values(LocationType).includes(type as LocationType)) {
          return {
            success: false,
            message: `Invalid location type. Must be one of: ${Object.values(LocationType).join(', ')}`,
          };
        }

        this.logger.log(`Fetching locations by type: ${type}`);
        const locations = await this.locationsService.getLocationsByType(type as LocationType);
        return {
          success: true,
          locations,
        };
      }

      // Otherwise return hierarchical structure
      this.logger.log('Fetching all locations');
      const locations = await this.locationsService.getAllLocations();
      return {
        success: true,
        locations,
      };
    } catch (error) {
      this.logger.error('Failed to fetch locations', error);
      throw error;
    }
  }
}
