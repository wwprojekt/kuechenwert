/**
 * ProtectedRoute Component Tests
 * Tests for authentication protection and route guarding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Mock the useAuth hook
const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithRouter = (children: React.ReactNode, initialRoute = '/protected') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route
          path="/protected"
          element={<ProtectedRoute>{children}</ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading spinner while loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    renderWithRouter(<div>Protected Content</div>);

    // Should show loading spinner
    expect(screen.getByRole('status', { hidden: true }) || document.querySelector('.animate-spin')).toBeTruthy();
    // Should not show content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    renderWithRouter(<div>Protected Content</div>);

    // Should redirect to login page
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    // Should not show protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      loading: false,
    });

    renderWithRouter(<div>Protected Content</div>);

    // Should show protected content
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    // Should not show login page
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('should render complex children components', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      loading: false,
    });

    renderWithRouter(
      <div>
        <h1>Dashboard</h1>
        <p>Welcome back!</p>
        <button>Action</button>
      </div>
    );

    expect(screen.getByRole('heading')).toHaveTextContent('Dashboard');
    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Action');
  });

  it('should handle auth state transitions', () => {
    // Start loading
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Should be loading
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();

    // Auth completes with user
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id' },
      loading: false,
    });

    rerender(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Now should show protected content
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('ProtectedRoute edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty children', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id' },
      loading: false,
    });

    // Should not throw when rendering with null/undefined children
    expect(() => renderWithRouter(null)).not.toThrow();
  });

  it('should handle rapid auth state changes', () => {
    // Simulate rapid loading state changes
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    
    const { rerender } = render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

    // Quick succession of state changes
    mockUseAuth.mockReturnValue({ user: { id: 'user' }, loading: false });
    rerender(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={<ProtectedRoute><div>Protected Content</div></ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
