'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { registerAction, type RegisterState } from '@/app/login/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const initialState: RegisterState = { error: null };

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        label="Username"
        name="username"
        autoComplete="username"
        required
        minLength={3}
        maxLength={50}
        placeholder="Enter a username"
        autoFocus
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={1024}
        placeholder="At least 8 characters"
      />
      <Input
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={1024}
        placeholder="Re-enter your password"
      />
      {state.error && (
        <p role="alert" className="text-sm font-medium text-rose-700">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full mt-2" isLoading={isPending}>
        Create account
      </Button>
      <div className="pt-2 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
}
