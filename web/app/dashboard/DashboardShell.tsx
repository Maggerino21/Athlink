'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar, { type DashTab } from '@/components/Sidebar';
import OverviewTab  from './tabs/OverviewTab';
import AthletesTab from './tabs/AthletesTab';
import CalendarTab from './tabs/CalendarTab';
import NewEventTab from './tabs/NewEventTab';
import GroupsTab   from './tabs/GroupsTab';
import ClubTab     from './tabs/ClubTab';
import { accentTokens } from '@/lib/clubTheme';
import { syncFixtures, isSyncStale } from '@/lib/syncFixtures';
import FeedbackTab from './tabs/FeedbackTab';
import TasksTab    from './tabs/TasksTab';
import ProfileTab  from './tabs/ProfileTab';

/** Rewrites the accent variables the dashboard layout set server-side. They live on
 *  #dashboard-root rather than :root, so they must be set on that same element to win
 *  for its descendants. Uses the same accentTokens() as the layout, so the two cannot
 *  produce different results. */
function applyAccent(color: string) {
  const root = document.getElementById('dashboard-root');
  if (!root) return;
  for (const [key, value] of Object.entries(accentTokens(color))) {
    root.style.setProperty(key, value);
  }
}

export default function DashboardShell({
  staffName,
  staffEmail,
  staffRole,
  staffLanguage,
  staffJoinedAt,
  clubName,
  clubColor,
  inviteCode,
  staffInviteCode,
  isClubManager,
  externalTeamId,
  externalSyncedAt,
  staffId,
  clubId,
}: {
  staffName:        string;
  staffEmail:       string;
  staffRole:        string;
  staffLanguage:    string;
  staffJoinedAt:    string;
  clubName:         string;
  clubColor:        string;
  inviteCode:       string | null;
  staffInviteCode:  string | null;
  isClubManager:    boolean;
  externalTeamId:   number | null;
  externalSyncedAt: string | null;
  staffId:          string;
  clubId:           string;
}) {
  const [tab,          setTab]          = useState<DashTab>('overview');
  // Editable on the profile tab, so it lives here rather than being read straight from
  // the prop — the sidebar has to pick a rename up without a reload.
  const [name,         setName]         = useState(staffName);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  // Club name and colour can be edited on the Club tab. Holding them here lets the
  // sidebar and theme update immediately, with no reload to knock you off the page.
  const [club, setClub] = useState({ name: clubName, color: clubColor });

  // Fixtures are pulled in here rather than at signup: at signup there may be no session
  // yet (email confirmation), and a club can link a team later from the Club page. Running
  // on dashboard mount covers both, and refreshes a stale season without being asked.
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (syncedOnce.current) return;
    if (!externalTeamId) return;
    if (!isSyncStale(externalSyncedAt)) return;
    syncedOnce.current = true;
    // Deliberately un-awaited and silent: a failed sync must never block the dashboard,
    // and the calendar simply shows whatever is already there.
    void syncFixtures(externalTeamId);
  }, [externalTeamId, externalSyncedAt]);

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
        staffName={name}
        clubName={club.name}
        clubColor={club.color}
        activeTab={tab}
        onTabChange={handleTabChange}
      />

      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        {tab === 'overview'  && (
          <OverviewTab
            clubId={clubId}
            staffName={name}
            clubName={clubName}
            inviteCode={inviteCode}
            staffInviteCode={staffInviteCode}
          />
        )}
        {tab === 'athletes'  && (
          <AthletesTab
            staffId={staffId}
            clubId={clubId}
            clubName={club.name}
            inviteCode={inviteCode}
            staffInviteCode={staffInviteCode}
          />
        )}
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
        {tab === 'profile'   && (
          <ProfileTab
            profileId={staffId}
            fullName={name}
            email={staffEmail}
            role={staffRole}
            isClubManager={isClubManager}
            language={staffLanguage}
            joinedAt={staffJoinedAt}
            clubName={club.name}
            onNameChanged={setName}
          />
        )}
        {tab === 'new'       && (
          <NewEventTab
            clubId={clubId}
            clubName={club.name}
            prefilledDate={prefilledDate}
            onCreatedFromCalendar={handleCreatedFromCalendar}
          />
        )}
      </main>
    </>
  );
}
