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
    this.logger.log(`[REQUEST] GET /locations - Incoming request with query params: type=${type || 'none'}`);
    
    try {
      // If type is provided, filter by type
      if (type) {
        this.logger.debug(`[VALIDATION] Checking if type="${type}" is a valid LocationType`);
        
        // Validate the type is a valid LocationType enum
        if (!Object.values(LocationType).includes(type as LocationType)) {
          this.logger.warn(`[VALIDATION] Invalid location type provided: ${type}. Valid types: ${Object.values(LocationType).join(', ')}`);
          return {
            success: false,
            message: `Invalid location type. Must be one of: ${Object.values(LocationType).join(', ')}`,
          };
        }

        this.logger.log(`[ACTION] Fetching locations by type: ${type}`);
        const locations = await this.locationsService.getLocationsByType(type as LocationType);
        
        this.logger.log(`[RESPONSE] GET /locations?type=${type} - Successfully returned ${locations.length} locations`);
        return {
          success: true,
          locations,
        };
      }

      // Otherwise return hierarchical structure
      this.logger.log('[ACTION] Fetching all locations with hierarchical structure');
      const locations = await this.locationsService.getAllLocations();
      
      this.logger.log(`[RESPONSE] GET /locations - Successfully returned ${locations.length} root locations`);
      return {
        success: true,
        locations,
      };
    } catch (error) {
      this.logger.error(`[ERROR] GET /locations - Request failed - ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
