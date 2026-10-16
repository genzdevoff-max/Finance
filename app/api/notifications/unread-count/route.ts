import { getUnreadNotificationsCount } from '@/lib/services/notifications.service';
import { isAuthenticated } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const count = await getUnreadNotificationsCount();
    return Response.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load unread notification count:', error);
    return Response.json({ error: 'Unable to load notification count.' }, { status: 500 });
  }
}
