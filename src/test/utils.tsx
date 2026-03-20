/**
 * Test Utilities
 * Custom render functions and test helpers
 */

import React, { type ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock contexts
const MockAuthContext = React.createContext({
  user: null,
  session: null,
  loading: false,
  signOut: async () => {},
});

const MockSettingsContext = React.createContext({
  settings: {
    id: 'test',
    site_name: 'CaravanWert Test',
    site_tagline: 'Test Tagline',
    site_description: 'Test Description',
    contact_email: 'test@example.com',
    support_phone: '+49 123 456789',
    maintenance_mode: false,
    logo_url: null,
    favicon_url: null,
    primary_color: '25 93 62',
    secondary_color: '210 40 28',
    dark_mode_enabled: false,
    meta_title: 'Test Title',
    meta_description: 'Test Meta Description',
    meta_keywords: 'test, keywords',
    default_auction_duration_days: 7,
    soft_close_extension_minutes: 5,
    min_bid_increment_percent: 2,
    commission_rate_percent: 5,
    reserve_price_required: false,
    autobid_enabled: true,
    buy_now_enabled: true,
  },
  loading: false,
  refreshSettings: async () => {},
});

interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  user?: any;
  settings?: any;
}

// Wrapper component with all providers
function AllProviders({ 
  children, 
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
  user = null,
  settings = null,
}: AllProvidersProps) {
  const mockAuthValue = {
    user,
    session: user ? { user } : null,
    loading: false,
    signOut: async () => {},
  };

  const mockSettingsValue = {
    settings: settings || MockSettingsContext._currentValue.settings,
    loading: false,
    refreshSettings: async () => {},
  };

  return (
    <QueryClientProvider client={queryClient}>
      <MockAuthContext.Provider value={mockAuthValue}>
        <MockSettingsContext.Provider value={mockSettingsValue}>
          <BrowserRouter>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </BrowserRouter>
        </MockSettingsContext.Provider>
      </MockAuthContext.Provider>
    </QueryClientProvider>
  );
}

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  user?: any;
  settings?: any;
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient,
    user,
    settings,
    route = '/',
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  // Set initial route
  if (route !== '/') {
    window.history.pushState({}, 'Test page', route);
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders 
        queryClient={queryClient}
        user={user}
        settings={settings}
      >
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
}

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockMotorhome = (overrides = {}) => ({
  id: 'test-motorhome-id',
  seller_id: 'test-user-id',
  manufacturer: 'Test Manufacturer',
  model: 'Test Model',
  year: 2020,
  mileage: 50000,
  condition: 'Sehr gut',
  body_type: 'Teilintegriert',
  sleeping_places: 4,
  has_bathroom: true,
  has_solar: true,
  has_awning: true,
  description: 'Test description',
  sale_channel: 'auction',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockAuction = (overrides = {}) => ({
  id: 'test-auction-id',
  motorhome_id: 'test-motorhome-id',
  starting_bid: 45000,
  current_bid: null,
  reserve_price: 45000,
  status: 'active',
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  soft_close_extension_minutes: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockBid = (overrides = {}) => ({
  id: 'test-bid-id',
  auction_id: 'test-auction-id',
  bidder_id: 'test-bidder-id',
  amount: 46000,
  is_autobid: false,
  max_autobid_amount: null,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockAppointment = (overrides = {}) => ({
  id: 'test-appointment-id',
  motorhome_id: 'test-motorhome-id',
  seller_id: 'test-user-id',
  station_id: 'test-station-id',
  appointment_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  duration_minutes: 60,
  status: 'scheduled',
  payment_method: 'cash',
  payment_status: 'pending',
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Wait utilities
export const waitForLoadingToFinish = () => {
  return new Promise((resolve) => setTimeout(resolve, 100));
};

// Mock file creation utility
export const createMockFile = (
  name = 'test-image.jpg',
  type = 'image/jpeg',
  _size = 1024 * 1024 // 1MB - reserved for future use
): File => {
  const blob = new Blob(['mock file content'], { type });
  return new File([blob], name, { type, lastModified: Date.now() });
};

// Mock form data
export const createMockFormData = (overrides = {}) => ({
  manufacturer: 'Test Manufacturer',
  model: 'Test Model',
  year: 2020,
  mileage: 50000,
  condition: 'Sehr gut',
  bodyType: 'Teilintegriert',
  description: 'Test description for motorhome',
  photos: [],
  saleChannel: 'auction',
  instantPrice: null,
  reservePrice: 45000,
  ...overrides,
});

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
