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
          invite_code: string;
          primary_color: string;
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
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      match_feedback: {
        Row: {
          id: string;
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
          type: 'training' | 'exercise' | 'recovery' | 'travel' | 'meeting' | 'other';
          title: string;
          description: string | null;
          event_date: string;
          location: string | null;
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
