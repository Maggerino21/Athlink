'use client';

import { useState } from 'react';
import Sidebar, { type DashTab } from '@/components/Sidebar';
import OverviewTab  from './tabs/OverviewTab';
import AthletesTab from './tabs/AthletesTab';
import CalendarTab from './tabs/CalendarTab';
import NewEventTab from './tabs/NewEventTab';
import GroupsTab   from './tabs/GroupsTab';
import ClubTab     from './tabs/ClubTab';
import FeedbackTab from './tabs/FeedbackTab';
import TasksTab    from './tabs/TasksTab';

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const full  = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '99, 102, 241';
  return `${r}, ${g}, ${b}`;
}

/** Rewrites the accent variables the dashboard layout set server-side. They live on
 *  #dashboard-root rather than :root, so they must be set on that same element to win
 *  for its descendants. Keep in sync with app/dashboard/layout.tsx. */
function applyAccent(color: string) {
  const root = document.getElementById('dashboard-root');
  if (!root) return;
  const rgb = hexToRgb(color);
  root.style.setProperty('--accent',        color);
  root.style.setProperty('--accent-subtle', `rgba(${rgb}, 0.12)`);
  root.style.setProperty('--accent-border', `rgba(${rgb}, 0.28)`);
  root.style.setProperty('--accent-glow',   `rgba(${rgb}, 0.18)`);
}

export default function DashboardShell({
  staffName,
  clubName,
  clubColor,
  inviteCode,
  staffInviteCode,
  isClubManager,
  staffId,
  clubId,
}: {
  staffName:       string;
  clubName:        string;
  clubColor:       string;
  inviteCode:      string | null;
  staffInviteCode: string | null;
  isClubManager:   boolean;
  staffId:         string;
  clubId:          string;
}) {
  const [tab,          setTab]          = useState<DashTab>('overview');
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  // Club name and colour can be edited on the Club tab. Holding them here lets the
  // sidebar and theme update immediately, with no reload to knock you off the page.
  const [club, setClub] = useState({ name: clubName, color: clubColor });

  function handleClubUpdated(name: string, color: string) {
    setClub({ name, color });
    applyAccent(color);
  }

  function handleAddEvent(date: string) {
    setPrefilledDate(date);
    setTab('new');
  }

  function handleTabChange(next: DashTab) {
    // Clear the pre-filled date when navigating away from or back to new tab manually
    if (next !== 'new') setPrefilledDate(undefined);
    setTab(next);
  }

  // An event started from a calendar day returns to the calendar once saved,
  // where the new entry is visible on the grid.
  function handleCreatedFromCalendar() {
    setPrefilledDate(undefined);
    setTab('calendar');
  }

  return (
    <>
      <Sidebar
        staffName={staffName}
        clubName={club.name}
        clubColor={club.color}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        {tab === 'overview'  && (
          <OverviewTab
            clubId={clubId}
            staffName={staffName}
            clubName={clubName}
            inviteCode={inviteCode}
            staffInviteCode={staffInviteCode}
          />
        )}
        {tab === 'athletes'  && <AthletesTab staffId={staffId} clubId={clubId} />}
        {tab === 'calendar'  && <CalendarTab clubId={clubId} onAddEvent={handleAddEvent} />}
        {tab === 'feedback'  && <FeedbackTab staffId={staffId} clubId={clubId} />}
        {tab === 'tasks'     && <TasksTab    staffId={staffId} clubId={clubId} />}
        {tab === 'groups'    && <GroupsTab clubId={clubId} />}
        {tab === 'club'      && (
          <ClubTab
            clubId={clubId}
            clubName={club.name}
            clubColor={club.color}
            staffId={staffId}
            isClubManager={isClubManager}
            inviteCode={inviteCode}
            staffInviteCode={staffInviteCode}
            onClubUpdated={handleClubUpdated}
          />
        )}
        {tab === 'new'       && (
          <NewEventTab
            clubId={clubId}
            prefilledDate={prefilledDate}
            onCreatedFromCalendar={handleCreatedFromCalendar}
          />
        )}
      </main>
    </>
  );
}
