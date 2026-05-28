import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetUser = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn((url, key, opts) => ({
    auth: { getUser: mockGetUser },
  })),
}));

function makeNextUrl(urlStr: string): URL {
  const u = new URL(urlStr);
  (u as any).clone = () => new URL(u.href);
  return u as any;
}

function createRequest(url: string): NextRequest {
  return {
    url,
    nextUrl: makeNextUrl(url),
    cookies: { getAll: vi.fn(() => []), set: vi.fn(), get: vi.fn() },
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe('updateSession (middleware)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow access to public routes without a user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/'));
    expect(res.status).toBe(200);
  });

  it('should redirect unauthenticated users from /admin to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/admin/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
    expect(res.headers.get('location')).toContain('redirect=%2Fadmin%2Fdashboard');
  });

  it('should redirect unauthenticated users from /merchant to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/merchant'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('should redirect unauthenticated users from /company to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/company'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('should redirect unauthenticated users from /employee to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/employee'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('should allow authenticated users on protected routes', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { user_type: 'admin' } } }, error: null,
    });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/admin'));
    expect(res.status).toBe(200);
  });

  it('should redirect authenticated users from /login to their dashboard', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { user_type: 'admin' } } }, error: null,
    });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin');
  });

  it('should redirect company_admin from /login to /company', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { user_type: 'company_admin' } } }, error: null,
    });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/login'));
    expect(res.headers.get('location')).toContain('/company');
  });

  it('should default to /employee when no user_type', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: {} } }, error: null,
    });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/login'));
    expect(res.headers.get('location')).toContain('/employee');
  });

  it('should not protect public API routes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { updateSession } = await import('@/lib/supabase/middleware');
    const res = await updateSession(createRequest('http://localhost:3000/api/analytics'));
    expect(res.status).toBe(200);
  });
});
