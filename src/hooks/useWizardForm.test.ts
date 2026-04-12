/**
 * Wizard Form Hook Tests
 * Tests for the useWizardForm hook functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardForm } from './useWizardForm';
import { createMockFile } from '@/test/utils';

// Mock the dependencies
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('useWizardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default form data', () => {
    const { result } = renderHook(() => useWizardForm());

    expect(result.current.formData).toEqual(
      expect.objectContaining({
        manufacturer: '',
        model: '',
        year: null,
        mileage: null,
        condition: '',
        bodyType: '',
        description: '',
        photos: [],
        saleChannel: '',
      })
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should update form data correctly', () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
      });
    });

    expect(result.current.formData.manufacturer).toBe('Hymer');
    expect(result.current.formData.model).toBe('B-Klasse');
    expect(result.current.formData.year).toBe(2020);
  });

  it('should validate step 1 correctly', async () => {
    const { result } = renderHook(() => useWizardForm());

    // Set valid data for step 1
    act(() => {
      result.current.updateFormData({
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        condition: 'Sehr gut',
        bodyType: 'Teilintegriert',
        description: 'Test description with enough characters',
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(1);
    });

    expect(isValid).toBe(true);
  });

  it('should reject invalid step 1 data', async () => {
    const { result } = renderHook(() => useWizardForm());

    // Set invalid data (missing required fields)
    act(() => {
      result.current.updateFormData({
        manufacturer: '',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        condition: 'Sehr gut',
        bodyType: 'Teilintegriert',
        description: 'Short', // Too short
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(1);
    });

    expect(isValid).toBe(false);
  });

  it('should validate step 3 (dimensions) with valid seats and sleeping places', async () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        seats_with_seatbelts: 4,
        sleeping_places: 2,
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(3);
    });

    expect(isValid).toBe(true);
  });

  it('should reject step 3 with missing seats and sleeping places', async () => {
    const { result } = renderHook(() => useWizardForm());

    // Leave seats_with_seatbelts and sleeping_places as null (default)
    const isValid = await act(async () => {
      return result.current.validateStep(3);
    });

    expect(isValid).toBe(false);
  });

  it('should reject step 3 with negative seats', async () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        seats_with_seatbelts: -5,
        sleeping_places: 2,
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(3);
    });

    expect(isValid).toBe(false);
  });

  it('should validate step 6 (photos) correctly', async () => {
    const { result } = renderHook(() => useWizardForm());

    // Create mock files (minimum 4 required)
    const mockFiles = Array.from({ length: 4 }, (_, i) => 
      createMockFile(`photo-${i}.jpg`)
    );

    act(() => {
      result.current.updateFormData({
        photos: mockFiles,
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(6);
    });

    expect(isValid).toBe(true);
  });

  it('should reject insufficient photos for step 6', async () => {
    const { result } = renderHook(() => useWizardForm());

    // Only 3 photos (need minimum 4)
    const mockFiles = Array.from({ length: 3 }, (_, i) => 
      createMockFile(`photo-${i}.jpg`)
    );

    act(() => {
      result.current.updateFormData({
        photos: mockFiles,
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(6);
    });

    expect(isValid).toBe(false);
  });

  it('should validate step 8 (sale channel) correctly', async () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        saleChannel: 'auction',
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(8);
    });

    expect(isValid).toBe(true);
  });

  it('should reject empty sale channel', async () => {
    const { result } = renderHook(() => useWizardForm());

    act(() => {
      result.current.updateFormData({
        saleChannel: '',
      });
    });

    const isValid = await act(async () => {
      return result.current.validateStep(8);
    });

    expect(isValid).toBe(false);
  });

  it('should handle form submission error gracefully', async () => {
    const mockToast = vi.fn();
    vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
      toast: mockToast,
    });

    // Mock Supabase error
    vi.mocked(require('@/integrations/supabase/client').supabase.auth.getUser)
      .mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useWizardForm());

    await act(async () => {
      await result.current.submitForm();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Fehler',
        variant: 'destructive',
      })
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should handle successful form submission', async () => {
    const mockNavigate = vi.fn();
    const mockToast = vi.fn();

    vi.mocked(require('react-router-dom').useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({
      toast: mockToast,
    });

    // Mock successful Supabase responses
    const mockUser = { id: 'test-user-id', email: 'test@example.com' };
    vi.mocked(require('@/integrations/supabase/client').supabase.auth.getUser)
      .mockResolvedValue({ data: { user: mockUser }, error: null });

    vi.mocked(require('@/integrations/supabase/client').supabase.storage.from().upload)
      .mockResolvedValue({ error: null });

    vi.mocked(require('@/integrations/supabase/client').supabase.from().insert)
      .mockResolvedValue({ data: { id: 'test-motorhome-id' }, error: null });

    const { result } = renderHook(() => useWizardForm());

    // Set up valid form data
    act(() => {
      result.current.updateFormData({
        manufacturer: 'Hymer',
        model: 'B-Klasse',
        year: 2020,
        mileage: 50000,
        condition: 'Sehr gut',
        bodyType: 'Teilintegriert',
        description: 'Test description with enough characters',
        saleChannel: 'auction',
        photos: [createMockFile()],
      });
    });

    await act(async () => {
      await result.current.submitForm();
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erfolg!',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
