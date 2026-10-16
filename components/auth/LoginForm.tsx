'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, type LoginState } from '@/app/login/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        required
        maxLength={191}
        autoFocus
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={1024}
      />
      {state.error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" isLoading={isPending}>
        Sign in
      </Button>
      <div className="pt-2 text-center text-sm text-slate-600">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          Create one
        </Link>
      </div>
    </form>
  );
}
