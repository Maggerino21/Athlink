'use client';

import { useState } from 'react';
import Sidebar, { type DashTab } from '@/components/Sidebar';
import OverviewTab from './tabs/OverviewTab';
import AthletesTab from './tabs/AthletesTab';

export default function DashboardShell({
  staffName,
  clubName,
  clubColor,
  staffId,
  clubId,
}: {
  staffName: string;
  clubName:  string;
  clubColor: string;
  staffId:   string;
  clubId:    string;
}) {
  const [tab, setTab] = useState<DashTab>('overview');

  return (
    <>
      <Sidebar
        staffName={staffName}
        clubName={clubName}
        clubColor={clubColor}
        activeTab={tab}
        onTabChange={setTab}
      />

      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        {tab === 'overview'  && <OverviewTab clubId={clubId} staffName={staffName} />}
        {tab === 'athletes'  && <AthletesTab staffId={staffId} clubId={clubId} />}
        {tab === 'calendar'  && <PlaceholderTab title="Calendar" />}
        {tab === 'feedback'  && <PlaceholderTab title="Feedback" />}
        {tab === 'tasks'     && <PlaceholderTab title="Tasks" />}
      </main>
    </>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div style={{ padding: '36px 40px' }}>
      <div className="t-label" style={{ marginBottom: 6 }}>Coming soon</div>
      <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
    </div>
  );
}
