'use client';

import { useState } from 'react';
import Sidebar, { type DashTab } from '@/components/Sidebar';
import OverviewTab  from './tabs/OverviewTab';
import AthletesTab from './tabs/AthletesTab';
import CalendarTab from './tabs/CalendarTab';
import NewEventTab from './tabs/NewEventTab';
import GroupsTab   from './tabs/GroupsTab';
import FeedbackTab from './tabs/FeedbackTab';
import TasksTab    from './tabs/TasksTab';

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
  const [tab,          setTab]          = useState<DashTab>('overview');
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  function handleAddEvent(date: string) {
    setPrefilledDate(date);
    setTab('new');
  }

  function handleTabChange(next: DashTab) {
    // Clear the pre-filled date when navigating away from or back to new tab manually
    if (next !== 'new') setPrefilledDate(undefined);
    setTab(next);
  }

  return (
    <>
      <Sidebar
        staffName={staffName}
        clubName={clubName}
        clubColor={clubColor}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        {tab === 'overview'  && <OverviewTab clubId={clubId} staffName={staffName} />}
        {tab === 'athletes'  && <AthletesTab staffId={staffId} clubId={clubId} />}
        {tab === 'calendar'  && <CalendarTab clubId={clubId} onAddEvent={handleAddEvent} />}
        {tab === 'feedback'  && <FeedbackTab staffId={staffId} clubId={clubId} />}
        {tab === 'tasks'     && <TasksTab    staffId={staffId} clubId={clubId} />}
        {tab === 'groups'    && <GroupsTab clubId={clubId} />}
        {tab === 'new'       && <NewEventTab clubId={clubId} prefilledDate={prefilledDate} />}
      </main>
    </>
  );
}
