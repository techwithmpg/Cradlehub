import { getCradleLiveData } from '@/lib/cradle-live/query';
import { CradleLiveBoard } from '@/components/features/cradle-live/cradle-live-board';
import { getFrontDeskContext } from '@/lib/queries/crm-context';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cradle Live | Operations Wallboard' };

// The route stays CRM-authorized and branch-scoped through getFrontDeskContext.
// This is a read-only surface; existing CRM routes continue to own all writes.
export default async function CradleLivePage({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  const params = await searchParams;
  if (process.env.NODE_ENV === 'development' && params.fixture === 'populated') {
    const context = await getFrontDeskContext();
    const { createPopulatedCradleLiveFixture } = await import('@/lib/cradle-live/fixture');
    return <CradleLiveBoard initial={createPopulatedCradleLiveFixture(context.branchName)} />;
  }
  const data = await getCradleLiveData();
  return <CradleLiveBoard initial={data} />;
}
