/**
 * Validation Schema Tests
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from 'vitest';
import { 
  kitchenBasicSchema,
  kitchenTechnicalSchema,
  kitchenDimensionsSchema,
  kitchenInteriorSchema,
  kitchenEquipmentSchema 
} from './validation';

describe('Kitchen Validation Schemas', () => {
  describe('kitchenBasicSchema', () => {
    it('should validate correct basic kitchen data', () => {
      const validData = {
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        body_type: 'Teilintegriert',
        condition: 'Sehr gut',
      };

      expect(() => kitchenBasicSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid manufacturer', () => {
      const invalidData = {
        manufacturer: '',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        body_type: 'Teilintegriert',
        condition: 'Sehr gut',
      };

      expect(() => kitchenBasicSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid year', () => {
      const invalidData = {
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 1940, // Too old
        mileage: 50000,
        body_type: 'Teilintegriert',
        condition: 'Sehr gut',
      };

      expect(() => kitchenBasicSchema.parse(invalidData)).toThrow();
    });

    it('should reject negative mileage', () => {
      const invalidData = {
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: -1000,
        body_type: 'Teilintegriert',
        condition: 'Sehr gut',
      };

      expect(() => kitchenBasicSchema.parse(invalidData)).toThrow();
    });

    it('should reject invalid body type', () => {
      const invalidData = {
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        body_type: 'Invalid Type',
        condition: 'Sehr gut',
      };

      expect(() => kitchenBasicSchema.parse(invalidData)).toThrow();
    });
  });

  describe('kitchenTechnicalSchema', () => {
    it('should validate correct technical data', () => {
      const validData = {
        fuel_type: 'Diesel',
        power_kw: 130,
        engine_power_hp: 177,
        transmission: 'Automatik',
        emission_class: 'Euro 6',
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => kitchenTechnicalSchema.parse(validData)).not.toThrow();
    });

    it('should accept optional fields as undefined', () => {
      const validData = {
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => kitchenTechnicalSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid power values', () => {
      const invalidData = {
        power_kw: -50, // Negative power
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => kitchenTechnicalSchema.parse(invalidData)).toThrow();
    });
  });

  describe('kitchenDimensionsSchema', () => {
    it('should validate correct dimensions', () => {
      const validData = {
        length_m: 700,
        width_m: 235,
        height_m: 280,
        weight_kg: 3500,
        payload_kg: 500,
        number_of_axles: 2,
        seats: 4,
        sleeping_places: 4,
      };

      expect(() => kitchenDimensionsSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid dimensions', () => {
      const invalidData = {
        length_m: 100, // Too short
        sleeping_places: 4,
      };

      expect(() => kitchenDimensionsSchema.parse(invalidData)).toThrow();
    });

    it('should require sleeping places', () => {
      const invalidData = {
        length_m: 700,
        // missing sleeping_places
      };

      expect(() => kitchenDimensionsSchema.parse(invalidData)).toThrow();
    });
  });

  describe('kitchenInteriorSchema', () => {
    it('should validate correct interior features', () => {
      const validData = {
        has_kitchen: true,
        refrigerator_type: 'Kompressor',
        heating_type: 'Gas',
        air_conditioning_type: 'Wohnraum',
        has_bathroom: true,
        has_toilet: true,
        has_shower: true,
        water_tank_liters: 100,
        grey_water_capacity_liters: 90,
      };

      expect(() => kitchenInteriorSchema.parse(validData)).not.toThrow();
    });

    it('should accept minimal interior configuration', () => {
      const validData = {
        has_kitchen: false,
        air_conditioning_type: 'Keine',
        has_bathroom: false,
        has_toilet: false,
        has_shower: false,
      };

      expect(() => kitchenInteriorSchema.parse(validData)).not.toThrow();
    });
  });

  describe('kitchenEquipmentSchema', () => {
    it('should validate correct equipment configuration', () => {
      const validData = {
        has_solar: true,
        solar_power_watts: 200,
        battery_capacity_ah: 100,
        has_inverter: true,
        has_awning: true,
        awning_length_m: 450,
        has_bike_rack: true,
        has_garage: false,
        has_tv: true,
        has_backup_camera: true,
        has_parking_sensors: true,
        has_cruise_control: true,
        has_central_locking: true,
      };

      expect(() => kitchenEquipmentSchema.parse(validData)).not.toThrow();
    });

    it('should validate solar power dependency', () => {
      const validData = {
        has_solar: false,
        solar_power_watts: undefined, // Should be allowed when has_solar is false
        has_awning: false,
        has_bike_rack: false,
        has_garage: false,
        has_tv: false,
        has_backup_camera: false,
        has_parking_sensors: false,
        has_cruise_control: false,
        has_central_locking: false,
      };

      expect(() => kitchenEquipmentSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid solar power values', () => {
      const invalidData = {
        has_solar: true,
        solar_power_watts: -100, // Negative value
        has_awning: false,
        has_bike_rack: false,
        has_garage: false,
        has_tv: false,
        has_backup_camera: false,
        has_parking_sensors: false,
        has_cruise_control: false,
        has_central_locking: false,
      };

      expect(() => kitchenEquipmentSchema.parse(invalidData)).toThrow();
    });
  });
});
