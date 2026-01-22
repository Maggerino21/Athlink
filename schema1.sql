-- USERS & AUTH (leverages Supabase auth.users)
-- profiles table extends Supabase auth
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('athlete', 'staff')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  club_id UUID REFERENCES clubs(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLUBS (keeps it simple for now)
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATCHES (core calendar event type)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  match_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  is_home BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('upcoming', 'completed', 'cancelled')) DEFAULT 'upcoming',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATCH PLANNING (staff plans before match)
CREATE TABLE match_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  focus_areas TEXT, -- What to focus on this match
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MATCH FEEDBACK (staff feedback after match, per athlete)
CREATE TABLE match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id),
  created_by UUID NOT NULL REFERENCES profiles(id), -- which staff gave feedback
  feedback_text TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SELF ASSESSMENTS (athletes assess themselves after match)
CREATE TABLE self_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 10), -- simple 1-10 scale
  notes TEXT, -- What went well, what didn't
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS (generic task system - can be recovery, training, video review, etc)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  assigned_to UUID NOT NULL REFERENCES profiles(id), -- which athlete
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  status TEXT CHECK (status IN ('pending', 'completed', 'unable')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profiles_club ON profiles(club_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_matches_club_date ON matches(club_id, match_date);
CREATE INDEX idx_match_feedback_athlete ON match_feedback(athlete_id);
CREATE INDEX idx_match_feedback_match ON match_feedback(match_id);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);