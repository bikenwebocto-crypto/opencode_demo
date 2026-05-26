'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { authService } from '@/services/auth.service';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@/schemas';
import type { LoginResponse, UserType } from '@/types';

export async function loginAction(formData: FormData): Promise<LoginResponse> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    userType: formData.get('userType') as UserType,
  };

  const parsed = loginSchema.parse(raw);

  // Authenticate via Supabase
  const supabaseClient = await createClient();
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (authError || !authData.session) {
    throw new Error('Invalid credentials');
  }

  // Get user from our DB
  const result = await authService.login(parsed);
  if (!result) {
    throw new Error('Authentication failed');
  }

  return result;
}

export async function logoutAction(): Promise<void> {
  const supabaseClient = await createClient();
  await supabaseClient.auth.signOut();
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get('email') as string,
    userType: formData.get('userType') as UserType,
  };

  const parsed = forgotPasswordSchema.parse(raw);

  const supabaseClient = await createClient();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(parsed.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) throw new Error(error.message);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const raw = {
    token: formData.get('token') as string,
    password: formData.get('password') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const parsed = resetPasswordSchema.parse(raw);

  const supabaseClient = await createClient();
  const { error } = await supabaseClient.auth.updateUser({
    password: parsed.password,
  });

  if (error) throw new Error(error.message);
}

export async function refreshSessionAction(): Promise<LoginResponse | null> {
  const supabaseClient = await createClient();
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) return null;

  const refreshToken = session.refresh_token;
  if (!refreshToken) return null;

  return authService.refreshAccessToken(refreshToken);
}
