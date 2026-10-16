import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth/config';
import { verifySessionToken } from '@/lib/auth/session';

function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0, must-revalidate');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifySessionToken(token);
  const pathname = request.nextUrl.pathname;

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (isAuthRoute) {
    if (authenticated) {
      return setSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    return setSecurityHeaders(NextResponse.next());
  }

  if (!authenticated) {
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
      response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      response.cookies.delete(SESSION_COOKIE_NAME);
      return setSecurityHeaders(response);
    }

    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return setSecurityHeaders(response);
  }

  return setSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)'],
};
