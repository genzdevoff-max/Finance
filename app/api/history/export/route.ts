import {
  createHistoryWorkbook,
  historyWorkbookFileName,
} from '@/lib/reports/history-workbook';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const personId = url.searchParams.get('personId') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;

  try {
    const workbook = await createHistoryWorkbook({ personId, startDate, endDate });
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = historyWorkbookFileName(
      { personId, startDate, endDate },
      personId ? workbook.title : undefined
    );
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export history.';
    const isInputError =
      message.includes('must be a valid date') ||
      message === 'Start date must be on or before end date.';
    const status = message === 'Person not found.' ? 404 : isInputError ? 400 : 500;
    console.error('History workbook export failed:', error);
    return new Response(status === 500 ? 'Unable to export history.' : message, { status });
  }
}
