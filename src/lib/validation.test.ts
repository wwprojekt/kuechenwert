/**
 * Validation Schema Tests
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from 'vitest';
import { 
  motorhomeBasicSchema,
  motorhomeTechnicalSchema,
  motorhomeDimensionsSchema,
  motorhomeInteriorSchema,
  motorhomeEquipmentSchema 
} from './validation';

describe('Motorhome Validation Schemas', () => {
  describe('motorhomeBasicSchema', () => {
    it('should validate correct basic motorhome data', () => {
      const validData = {
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        body_type: 'Teilintegriert',
        condition: 'Sehr gut',
      };

      expect(() => motorhomeBasicSchema.parse(validData)).not.toThrow();
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

      expect(() => motorhomeBasicSchema.parse(invalidData)).toThrow();
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

      expect(() => motorhomeBasicSchema.parse(invalidData)).toThrow();
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

      expect(() => motorhomeBasicSchema.parse(invalidData)).toThrow();
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

      expect(() => motorhomeBasicSchema.parse(invalidData)).toThrow();
    });
  });

  describe('motorhomeTechnicalSchema', () => {
    it('should validate correct technical data', () => {
      const validData = {
        fuel_type: 'Diesel',
        power_kw: 130,
        power_ps: 177,
        transmission: 'Automatik',
        emission_class: 'Euro 6',
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => motorhomeTechnicalSchema.parse(validData)).not.toThrow();
    });

    it('should accept optional fields as undefined', () => {
      const validData = {
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => motorhomeTechnicalSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid power values', () => {
      const invalidData = {
        power_kw: -50, // Negative power
        accident_free: true,
        non_smoker: true,
        service_history_available: false,
      };

      expect(() => motorhomeTechnicalSchema.parse(invalidData)).toThrow();
    });
  });

  describe('motorhomeDimensionsSchema', () => {
    it('should validate correct dimensions', () => {
      const validData = {
        length_cm: 700,
        width_cm: 235,
        height_cm: 280,
        total_weight_kg: 3500,
        payload_kg: 500,
        number_of_axles: 2,
        seats_with_seatbelts: 4,
        sleeping_places: 4,
      };

      expect(() => motorhomeDimensionsSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid dimensions', () => {
      const invalidData = {
        length_cm: 100, // Too short
        sleeping_places: 4,
      };

      expect(() => motorhomeDimensionsSchema.parse(invalidData)).toThrow();
    });

    it('should require sleeping places', () => {
      const invalidData = {
        length_cm: 700,
        // missing sleeping_places
      };

      expect(() => motorhomeDimensionsSchema.parse(invalidData)).toThrow();
    });
  });

  describe('motorhomeInteriorSchema', () => {
    it('should validate correct interior features', () => {
      const validData = {
        has_kitchen: true,
        refrigerator_type: 'Kompressor',
        heating_type: 'Gas',
        air_conditioning: 'Wohnraum',
        has_bathroom: true,
        has_toilet: true,
        has_shower: true,
        fresh_water_capacity_liters: 100,
        grey_water_capacity_liters: 90,
      };

      expect(() => motorhomeInteriorSchema.parse(validData)).not.toThrow();
    });

    it('should accept minimal interior configuration', () => {
      const validData = {
        has_kitchen: false,
        air_conditioning: 'Keine',
        has_bathroom: false,
        has_toilet: false,
        has_shower: false,
      };

      expect(() => motorhomeInteriorSchema.parse(validData)).not.toThrow();
    });
  });

  describe('motorhomeEquipmentSchema', () => {
    it('should validate correct equipment configuration', () => {
      const validData = {
        has_solar: true,
        solar_power_watts: 200,
        battery_capacity_ah: 100,
        has_inverter: true,
        has_awning: true,
        awning_length_cm: 450,
        has_bike_rack: true,
        has_garage: false,
        has_tv_sat: true,
        has_reversing_camera: true,
        has_parking_sensors: true,
        has_cruise_control: true,
        has_central_locking: true,
      };

      expect(() => motorhomeEquipmentSchema.parse(validData)).not.toThrow();
    });

    it('should validate solar power dependency', () => {
      const validData = {
        has_solar: false,
        solar_power_watts: undefined, // Should be allowed when has_solar is false
        has_awning: false,
        has_bike_rack: false,
        has_garage: false,
        has_tv_sat: false,
        has_reversing_camera: false,
        has_parking_sensors: false,
        has_cruise_control: false,
        has_central_locking: false,
      };

      expect(() => motorhomeEquipmentSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid solar power values', () => {
      const invalidData = {
        has_solar: true,
        solar_power_watts: -100, // Negative value
        has_awning: false,
        has_bike_rack: false,
        has_garage: false,
        has_tv_sat: false,
        has_reversing_camera: false,
        has_parking_sensors: false,
        has_cruise_control: false,
        has_central_locking: false,
      };

      expect(() => motorhomeEquipmentSchema.parse(invalidData)).toThrow();
    });
  });
});
