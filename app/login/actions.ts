'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/auth/config';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSessionToken } from '@/lib/auth/session';
import { ensureDbInitialized, isDbConfigured } from '@/lib/db';
import { createUser, getUserByUsername } from '@/lib/services/user.service';

export interface LoginState {
  error: string | null;
}

export interface RegisterState {
  error: string | null;
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!isDbConfigured()) {
    return { error: 'Database is not configured. Please check your database settings.' };
  }

  const usernameValue = formData.get('username');
  const passwordValue = formData.get('password');

  if (
    typeof usernameValue !== 'string' ||
    usernameValue.trim().length === 0 ||
    usernameValue.length > 191 ||
    typeof passwordValue !== 'string' ||
    passwordValue.length === 0 ||
    passwordValue.length > 1024
  ) {
    return { error: 'Invalid username or password.' };
  }

  const trimmedUsername = usernameValue.trim();

  try {
    await ensureDbInitialized();

    const user = await getUserByUsername(trimmedUsername);
    if (!user) {
      return { error: 'Invalid username or password.' };
    }

    const passwordMatches = await verifyPassword(passwordValue, user.passwordHash);
    if (!passwordMatches) {
      return { error: 'Invalid username or password.' };
    }

    const token = await createSessionToken(user.username, user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });
  } catch (error) {
    console.error('Login error:', error);
    return { error: error instanceof Error ? error.message : 'Login failed. Please try again.' };
  }

  redirect('/dashboard');
}

export async function registerAction(
  _previousState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  if (!isDbConfigured()) {
    return { error: 'Database is not configured. Please check your database settings.' };
  }

  const usernameValue = formData.get('username');
  const passwordValue = formData.get('password');
  const confirmPasswordValue = formData.get('confirmPassword');

  const username = typeof usernameValue === 'string' ? usernameValue.trim() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';
  const confirmPassword = typeof confirmPasswordValue === 'string' ? confirmPasswordValue : '';

  if (!username || username.length < 3 || username.length > 50) {
    return { error: 'Username must be between 3 and 50 characters long.' };
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return { error: 'Username can only contain letters, numbers, dots, underscores, and hyphens.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  if (password.length > 1024) {
    return { error: 'Password is too long.' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  try {
    await ensureDbInitialized();

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return { error: 'A user with this username already exists.' };
    }

    const passwordHash = await hashPassword(password);
    const newUser = await createUser(username, passwordHash);

    const token = await createSessionToken(newUser.username, newUser.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_DURATION_SECONDS,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return {
      error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
    };
  }

  redirect('/dashboard');
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}
