import { RegisterForm } from '@/components/auth/RegisterForm';
import { isAuthConfigured } from '@/lib/auth/config';

export const metadata = {
  title: 'Register | Finance Tracker',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  const authConfigured = isAuthConfigured();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-black text-white">
            F
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create an Account</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign up to manage and track loans and collections.
          </p>
        </div>
        {authConfigured ? (
          <RegisterForm />
        ) : (
          <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Authentication is not configured. Ensure database connection and AUTH_SESSION_SECRET are set.
          </p>
        )}
      </section>
    </div>
  );
}
