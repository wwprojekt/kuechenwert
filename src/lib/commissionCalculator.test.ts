/**
 * Commission Calculator Tests
 * Tests for commission calculation formatting and logic
 */

import { describe, it, expect } from 'vitest';
import { commissionCalculator, type CommissionCalculation } from './commissionCalculator';

describe('CommissionCalculatorService', () => {
  describe('formatCommissionBreakdown', () => {
    it('formats a basic commission calculation correctly', () => {
      const calculation: CommissionCalculation = {
        base_rate: 1.5,
        volume_discount: 0,
        final_rate: 1.5,
        commission_amount: 750,
        total_cost: 50750,
        savings: 0,
      };

      const result = commissionCalculator.formatCommissionBreakdown(calculation);

      expect(result.baseCommission).toContain('750');
      expect(result.volumeDiscount).toBe('Kein Rabatt');
      expect(result.finalCommission).toContain('750');
      expect(result.totalCost).toContain('50.750');
      expect(result.savings).toBe('€0,00');
    });

    it('formats commission with volume discount', () => {
      const calculation: CommissionCalculation = {
        base_rate: 1.5,
        volume_discount: 10,
        final_rate: 1.35,
        commission_amount: 675,
        total_cost: 50675,
        savings: 75,
      };

      const result = commissionCalculator.formatCommissionBreakdown(calculation);

      expect(result.volumeDiscount).toBe('10% Rabatt');
      expect(result.savings).toContain('75');
    });

    it('handles zero commission correctly', () => {
      const calculation: CommissionCalculation = {
        base_rate: 0,
        volume_discount: 0,
        final_rate: 0,
        commission_amount: 0,
        total_cost: 50000,
        savings: 0,
      };

      const result = commissionCalculator.formatCommissionBreakdown(calculation);

      expect(result.baseCommission).toContain('0');
      expect(result.savings).toBe('€0,00');
    });

    it('handles large amounts', () => {
      const calculation: CommissionCalculation = {
        base_rate: 1.5,
        volume_discount: 15,
        final_rate: 1.275,
        commission_amount: 6375,
        total_cost: 506375,
        savings: 1125,
      };

      const result = commissionCalculator.formatCommissionBreakdown(calculation);

      expect(result.volumeDiscount).toBe('15% Rabatt');
      // Should handle thousands formatting
      expect(result.totalCost).toBeDefined();
    });
  });
});

describe('Commission calculation edge cases', () => {
  it('should show no discount when volume_discount is 0', () => {
    const calculation: CommissionCalculation = {
      base_rate: 2,
      volume_discount: 0,
      final_rate: 2,
      commission_amount: 1000,
      total_cost: 51000,
      savings: 0,
    };

    const result = commissionCalculator.formatCommissionBreakdown(calculation);
    expect(result.volumeDiscount).toBe('Kein Rabatt');
  });

  it('should show discount when volume_discount is greater than 0', () => {
    const calculation: CommissionCalculation = {
      base_rate: 2,
      volume_discount: 5,
      final_rate: 1.9,
      commission_amount: 950,
      total_cost: 50950,
      savings: 50,
    };

    const result = commissionCalculator.formatCommissionBreakdown(calculation);
    expect(result.volumeDiscount).toBe('5% Rabatt');
  });
});
