export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: 'athlete' | 'staff';
          full_name: string;
          avatar_url: string | null;
          club_id: string | null;
          language: string | null;
          push_token: string | null;
          // Manager tier is a flag on top of role, not a third role value.
          is_club_manager: boolean;
          // Soft removal — null means still in the club.
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          // Which code someone signs up with determines their role.
          invite_code: string;        // athlete
          staff_invite_code: string;  // staff — full club admin
          primary_color: string;
          // Link to the external fixture provider. Badge is derived from
          // external_team_id, never stored.
          external_provider: string | null;
          external_team_id: number | null;
          external_team_name: string | null;
          external_synced_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clubs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['clubs']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          club_id: string;
          opponent: string;
          match_date: string;
          location: string | null;
          is_home: boolean;
          status: 'upcoming' | 'completed' | 'cancelled';
          created_by: string;
          // 'manual' rows are hand-entered and must never be touched by a sync.
          source: 'manual' | 'api';
          // Provider fixture id. Unique per club, so a re-sync upserts.
          external_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      match_feedback: {
        Row: {
          id: string;
          match_id: string | null;
          athlete_id: string;
          created_by: string;
          title: string | null;
          feedback_text: string;
          processed_text: string | null;
          action_point: string | null;
          athlete_language: string | null;
          is_ai_processed: boolean;
          acknowledged: boolean;
          acknowledged_at: string | null;
          reaction: string | null;
          athlete_reply: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['match_feedback']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['match_feedback']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          club_id: string;
          created_by: string;
          assigned_to: string;
          title: string;
          description: string | null;
          due_date: string | null;
          status: 'pending' | 'completed' | 'unable';
          completed_at: string | null;
          group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          club_id: string;
          created_by: string;
          type: 'training' | 'home' | 'rehab' | 'exercise' | 'recovery' | 'meeting' | 'vacation' | 'other';
          title: string;
          description: string | null;
          event_date: string;
          end_date: string | null;
          location: string | null;
          // Home training / rehab programmes upload a PDF to the event-pdfs bucket.
          pdf_url: string | null;
          // Generic events carry an optional schedule: [{ label, time }, …]
          line_items: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
    };
  };
};

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Club = Database['public']['Tables']['clubs']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchFeedback = Database['public']['Tables']['match_feedback']['Row'];
export type Task = Database['public']['Tables']['tasks']['Row'];
export type AthlinkEvent = Database['public']['Tables']['events']['Row'];
