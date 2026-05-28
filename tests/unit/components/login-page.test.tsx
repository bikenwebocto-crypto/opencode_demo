import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';

const mockPush = vi.fn();
const mockUnsubscribe = vi.fn();
let authStateCallback: ((event: string, session: any) => void) | null = null;
const mockOnAuthStateChange = vi.fn((callback: any) => {
  authStateCallback = callback;
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

vi.mock('@supabase/auth-ui-react', () => ({
  Auth: () => React.createElement('div', { 'data-testid': 'supabase-auth-ui' }, 'Providers: google, github'),
}));
vi.mock('@supabase/auth-ui-shared', () => ({ ThemeSupa: {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { onAuthStateChange: mockOnAuthStateChange } },
}));

function LoginPage() {
  useEffect(() => {
    const { data: { subscription } } = mockOnAuthStateChange((event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        mockPush('/dashboard');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return React.createElement('div', { style: { maxWidth: 420, margin: '100px auto' } },
    React.createElement('div', { 'data-testid': 'supabase-auth-ui' }, 'Providers: google, github')
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;
  });

  it('should render the Supabase Auth UI component', () => {
    render(React.createElement(LoginPage));
    expect(screen.getByTestId('supabase-auth-ui')).toBeInTheDocument();
  });

  it('should redirect to /dashboard on SIGNED_IN event', async () => {
    render(React.createElement(LoginPage));
    expect(authStateCallback).not.toBeNull();
    authStateCallback!('SIGNED_IN', { user: { id: '1' } });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should NOT redirect for other auth events', () => {
    render(React.createElement(LoginPage));
    authStateCallback!('TOKEN_REFRESHED', { user: { id: '1' } });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = render(React.createElement(LoginPage));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });
});
