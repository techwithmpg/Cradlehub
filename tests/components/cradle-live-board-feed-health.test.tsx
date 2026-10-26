// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveBoardData } from '@/lib/cradle-live/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

import { CradleLiveBoard } from '@/components/features/cradle-live/cradle-live-board';

afterEach(cleanup);

describe('Cradle Live feed health', () => {
  it('shows unavailable diagnostics and never calls an unknown issue feed healthy', () => {
    const initial: LiveBoardData = {
      branch: 'Sample Branch', businessDate: '2026-10-26', refreshedAt: new Date().toISOString(),
      bookings: null, summaryTotal: null, collectionToday: null, cashDrawer: null, expenses: null,
      staff: null, rosterSummary: null, attendanceRows: null, availableCount: null, trips: null,
      rooms: null, roomsWithSpace: null, availableSpaces: null, issues: null, events: null,
      errors: ['Operational issue feed unavailable'],
    };
    render(<CradleLiveBoard initial={initial} />);
    expect(document.body.textContent).toContain('Needs verification · 0 min ago');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Operational issue feed unavailable');
    expect(document.body.textContent).toContain('Issue summary unavailable');
    expect(document.body.textContent).not.toContain('No unresolved issues from connected feeds');
  });
});
