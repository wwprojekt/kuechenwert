/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test.com/image.jpg' } }),
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
    useLocation: vi.fn(() => ({ pathname: '/' })),
    useParams: vi.fn(() => ({})),
  };
});

// Mock image optimization
vi.mock('@/lib/imageOptimization', () => ({
  optimizeImage: vi.fn().mockResolvedValue({
    file: new File([''], 'test.jpg'),
    originalSize: 1000000,
    compressedSize: 500000,
    compressionRatio: 50,
    width: 800,
    height: 600,
    format: 'jpeg',
  }),
  optimizeImages: vi.fn().mockResolvedValue([]),
  validateImageFile: vi.fn().mockReturnValue({ valid: true }),
  OPTIMIZATION_PRESETS: {
    STANDARD: {
      maxWidth: 1200,
      maxHeight: 800,
      quality: 0.8,
      format: 'jpeg',
    },
  },
}));

// Mock error logger
vi.mock('@/lib/errorLogger', () => ({
  errorLogger: {
    logError: vi.fn(),
    logException: vi.fn(),
    logBusinessError: vi.fn(),
    logApiError: vi.fn(),
    logAuthError: vi.fn(),
    setUserContext: vi.fn(),
    clearUserContext: vi.fn(),
  },
  logError: vi.fn(),
  logException: vi.fn(),
  logBusinessError: vi.fn(),
  logApiError: vi.fn(),
  logAuthError: vi.fn(),
  setUserContext: vi.fn(),
  clearUserContext: vi.fn(),
}));

// Mock service worker
vi.mock('@/lib/serviceWorker', () => ({
  serviceWorkerManager: {
    register: vi.fn().mockResolvedValue(null),
    unregister: vi.fn().mockResolvedValue(false),
    update: vi.fn().mockResolvedValue(undefined),
    clearCache: vi.fn().mockResolvedValue(undefined),
    getCacheSize: vi.fn().mockResolvedValue(0),
  },
  registerSW: vi.fn(),
  unregisterSW: vi.fn(),
  updateSW: vi.fn(),
  clearSWCache: vi.fn(),
  getSWCacheSize: vi.fn(),
  applySWUpdate: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('sessionStorage', sessionStorageMock);

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Mock HTMLCanvasElement methods
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
});

HTMLCanvasElement.prototype.toBlob = vi.fn((callback) => {
  const blob = new Blob([''], { type: 'image/jpeg' });
  callback(blob);
});

// Mock File constructor
global.File = class MockFile extends Blob {
  name: string;
  lastModified: number;
  
  constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
    super(bits, options);
    this.name = name;
    this.lastModified = options?.lastModified || Date.now();
  }
} as any;

// Setup global test utilities
declare global {
  interface Window {
    __TEST_ENV__: boolean;
  }
}

window.__TEST_ENV__ = true;

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
