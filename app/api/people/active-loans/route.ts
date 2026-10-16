import { getPeopleWithActiveLoansForCollection } from '@/lib/services/loans.service';
import { isAuthenticated } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isAuthenticated())) return Response.json({ error: 'Unauthorized.' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const query = params.get('q')?.trim() ?? '';
  const personId = params.get('personId')?.trim();
  if (!personId && query.length < 2) return Response.json({ people: [] });

  try {
    const people = await getPeopleWithActiveLoansForCollection(query, personId);
    return Response.json(
      { people },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Failed to search active loan borrowers:', error);
    return Response.json({ error: 'Unable to search active loan borrowers.' }, { status: 500 });
  }
}
