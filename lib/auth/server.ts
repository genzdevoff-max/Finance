import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from './config';
import { verifySessionToken } from './session';

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}
