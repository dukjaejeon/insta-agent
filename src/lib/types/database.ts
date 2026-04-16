export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  // Supabase JS v2.103+ 요구 필드 (PostgrestVersion 타입 추론용)
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          business_name: string | null;
          business_phone: string | null;
          license_number: string | null;
          default_locations: string[];
          brand_colors: Json;
          brand_fonts: Json;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          business_name?: string | null;
          business_phone?: string | null;
          license_number?: string | null;
          default_locations?: string[];
          brand_colors?: Json;
          brand_fonts?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          business_name?: string | null;
          business_phone?: string | null;
          license_number?: string | null;
          default_locations?: string[];
          brand_colors?: Json;
          brand_fonts?: Json;
          created_at?: string;
        };
        Relationships: never[];
      };
      benchmark_accounts: {
        Row: {
          id: string;
          user_id: string;
          handle: string;
          display_name: string | null;
          bio: string | null;
          follower_count: number | null;
          following_count: number | null;
          post_count: number | null;
          category: string | null;
          is_niche_account: boolean;
          tracking_enabled: boolean;
          tracking_cadence: string;
          last_analyzed_at: string | null;
          highlight_post_ids: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          handle: string;
          display_name?: string | null;
          bio?: string | null;
          follower_count?: number | null;
          following_count?: number | null;
          post_count?: number | null;
          category?: string | null;
          is_niche_account?: boolean;
          tracking_enabled?: boolean;
          tracking_cadence?: string;
          last_analyzed_at?: string | null;
          highlight_post_ids?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          handle?: string;
          display_name?: string | null;
          bio?: string | null;
          follower_count?: number | null;
          following_count?: number | null;
          post_count?: number | null;
          category?: string | null;
          is_niche_account?: boolean;
          tracking_enabled?: boolean;
          tracking_cadence?: string;
          last_analyzed_at?: string | null;
          highlight_post_ids?: string[] | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      benchmark_posts: {
        Row: {
          id: string;
          account_id: string | null;
          external_url: string | null;
          media_type: string | null;
          slide_count: number;
          caption: string | null;
          hashtags: string[] | null;
          posted_at: string | null;
          like_count: number | null;
          comment_count: number | null;
          view_count: number | null;
          screenshot_paths: string[] | null;
          top_comments: Json | null;
          tier: string | null;
          tier_signals: Json | null;
          tier_manual_override: string | null;
          is_from_highlight: boolean;
          within_scope: boolean;
          ocr_raw_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          external_url?: string | null;
          media_type?: string | null;
          slide_count?: number;
          caption?: string | null;
          hashtags?: string[] | null;
          posted_at?: string | null;
          like_count?: number | null;
          comment_count?: number | null;
          view_count?: number | null;
          screenshot_paths?: string[] | null;
          top_comments?: Json | null;
          tier?: string | null;
          tier_signals?: Json | null;
          tier_manual_override?: string | null;
          is_from_highlight?: boolean;
          within_scope?: boolean;
          ocr_raw_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string | null;
          external_url?: string | null;
          media_type?: string | null;
          slide_count?: number;
          caption?: string | null;
          hashtags?: string[] | null;
          posted_at?: string | null;
          like_count?: number | null;
          comment_count?: number | null;
          view_count?: number | null;
          screenshot_paths?: string[] | null;
          top_comments?: Json | null;
          tier?: string | null;
          tier_signals?: Json | null;
          tier_manual_override?: string | null;
          is_from_highlight?: boolean;
          within_scope?: boolean;
          ocr_raw_json?: Json | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      post_classifications: {
        Row: {
          post_id: string;
          primary_category: string | null;
          secondary_category: string | null;
          confidence: number | null;
          tags: string[] | null;
          classified_at: string;
        };
        Insert: {
          post_id: string;
          primary_category?: string | null;
          secondary_category?: string | null;
          confidence?: number | null;
          tags?: string[] | null;
          classified_at?: string;
        };
        Update: {
          post_id?: string;
          primary_category?: string | null;
          secondary_category?: string | null;
          confidence?: number | null;
          tags?: string[] | null;
          classified_at?: string;
        };
        Relationships: never[];
      };
      post_performance: {
        Row: {
          post_id: string;
          engagement_rate: number | null;
          percentile_within_category: number | null;
          is_top_performer: boolean;
          engagement_multiple: number | null;
          view_multiple: number | null;
          save_signals: number | null;
          share_signals: number | null;
          comment_depth_score: number | null;
          computed_at: string;
        };
        Insert: {
          post_id: string;
          engagement_rate?: number | null;
          percentile_within_category?: number | null;
          is_top_performer?: boolean;
          engagement_multiple?: number | null;
          view_multiple?: number | null;
          save_signals?: number | null;
          share_signals?: number | null;
          comment_depth_score?: number | null;
          computed_at?: string;
        };
        Update: {
          post_id?: string;
          engagement_rate?: number | null;
          percentile_within_category?: number | null;
          is_top_performer?: boolean;
          engagement_multiple?: number | null;
          view_multiple?: number | null;
          save_signals?: number | null;
          share_signals?: number | null;
          comment_depth_score?: number | null;
          computed_at?: string;
        };
        Relationships: never[];
      };
      viral_autopsies: {
        Row: {
          id: string;
          post_id: string | null;
          first_3sec_breakdown: Json | null;
          hook_anatomy: Json | null;
          emotion_curve: Json | null;
          info_density: Json | null;
          topicality_anchor: Json | null;
          comment_reaction_pattern: Json | null;
          algorithm_signals: Json | null;
          scarcity_exclusivity: Json | null;
          visual_impact_score: number | null;
          replicability: Json | null;
          why_viral_replicable: string[] | null;
          why_viral_situational: string[] | null;
          application_warnings: string[] | null;
          total_cost_usd: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id?: string | null;
          first_3sec_breakdown?: Json | null;
          hook_anatomy?: Json | null;
          emotion_curve?: Json | null;
          info_density?: Json | null;
          topicality_anchor?: Json | null;
          comment_reaction_pattern?: Json | null;
          algorithm_signals?: Json | null;
          scarcity_exclusivity?: Json | null;
          visual_impact_score?: number | null;
          replicability?: Json | null;
          why_viral_replicable?: string[] | null;
          why_viral_situational?: string[] | null;
          application_warnings?: string[] | null;
          total_cost_usd?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string | null;
          first_3sec_breakdown?: Json | null;
          hook_anatomy?: Json | null;
          emotion_curve?: Json | null;
          info_density?: Json | null;
          topicality_anchor?: Json | null;
          comment_reaction_pattern?: Json | null;
          algorithm_signals?: Json | null;
          scarcity_exclusivity?: Json | null;
          visual_impact_score?: number | null;
          replicability?: Json | null;
          why_viral_replicable?: string[] | null;
          why_viral_situational?: string[] | null;
          application_warnings?: string[] | null;
          total_cost_usd?: number | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      playbooks: {
        Row: {
          id: string;
          user_id: string;
          source_account_id: string | null;
          code: string;
          name: string;
          category: string | null;
          evidence_post_ids: string[] | null;
          viral_autopsy_ids: string[] | null;
          derived_from_viral: boolean;
          avg_engagement_rate: number | null;
          visual: Json;
          copy: Json;
          format: Json;
          hashtags: Json;
          timing: Json | null;
          is_recommended: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_account_id?: string | null;
          code: string;
          name: string;
          category?: string | null;
          evidence_post_ids?: string[] | null;
          viral_autopsy_ids?: string[] | null;
          derived_from_viral?: boolean;
          avg_engagement_rate?: number | null;
          visual: Json;
          copy: Json;
          format: Json;
          hashtags: Json;
          timing?: Json | null;
          is_recommended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_account_id?: string | null;
          code?: string;
          name?: string;
          category?: string | null;
          evidence_post_ids?: string[] | null;
          viral_autopsy_ids?: string[] | null;
          derived_from_viral?: boolean;
          avg_engagement_rate?: number | null;
          visual?: Json;
          copy?: Json;
          format?: Json;
          hashtags?: Json;
          timing?: Json | null;
          is_recommended?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: never[];
      };
      voice_profiles: {
        Row: {
          id: string;
          source_account_id: string | null;
          ending_ratio: Json | null;
          vocabulary_high_freq: string[] | null;
          vocabulary_banned: string[] | null;
          signature_phrases_blacklist: string[] | null;
          emoji_usage: Json | null;
          honorific_distance: string | null;
          structural_signatures: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_account_id?: string | null;
          ending_ratio?: Json | null;
          vocabulary_high_freq?: string[] | null;
          vocabulary_banned?: string[] | null;
          signature_phrases_blacklist?: string[] | null;
          emoji_usage?: Json | null;
          honorific_distance?: string | null;
          structural_signatures?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_account_id?: string | null;
          ending_ratio?: Json | null;
          vocabulary_high_freq?: string[] | null;
          vocabulary_banned?: string[] | null;
          signature_phrases_blacklist?: string[] | null;
          emoji_usage?: Json | null;
          honorific_distance?: string | null;
          structural_signatures?: string[] | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      analyses: {
        Row: {
          id: string;
          account_id: string | null;
          analysis_type: string | null;
          portfolio_breakdown: Json | null;
          top_patterns: Json | null;
          viral_highlights: Json | null;
          playbook_ids: string[] | null;
          voice_profile_id: string | null;
          total_cost_usd: number | null;
          llm_call_count: number | null;
          status: string;
          error_log: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          analysis_type?: string | null;
          portfolio_breakdown?: Json | null;
          top_patterns?: Json | null;
          viral_highlights?: Json | null;
          playbook_ids?: string[] | null;
          voice_profile_id?: string | null;
          total_cost_usd?: number | null;
          llm_call_count?: number | null;
          status?: string;
          error_log?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string | null;
          analysis_type?: string | null;
          portfolio_breakdown?: Json | null;
          top_patterns?: Json | null;
          viral_highlights?: Json | null;
          playbook_ids?: string[] | null;
          voice_profile_id?: string | null;
          total_cost_usd?: number | null;
          llm_call_count?: number | null;
          status?: string;
          error_log?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      listings: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          district: string | null;
          dong: string | null;
          complex_name: string | null;
          size_pyeong: number | null;
          size_sqm: number | null;
          floor: number | null;
          direction: string | null;
          price_info: Json | null;
          features: string[] | null;
          raw_memo: string | null;
          photo_paths: string[] | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          district?: string | null;
          dong?: string | null;
          complex_name?: string | null;
          size_pyeong?: number | null;
          size_sqm?: number | null;
          floor?: number | null;
          direction?: string | null;
          price_info?: Json | null;
          features?: string[] | null;
          raw_memo?: string | null;
          photo_paths?: string[] | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          district?: string | null;
          dong?: string | null;
          complex_name?: string | null;
          size_pyeong?: number | null;
          size_sqm?: number | null;
          floor?: number | null;
          direction?: string | null;
          price_info?: Json | null;
          features?: string[] | null;
          raw_memo?: string | null;
          photo_paths?: string[] | null;
          status?: string;
          created_at?: string;
        };
        Relationships: never[];
      };
      proposals: {
        Row: {
          id: string;
          listing_id: string | null;
          playbook_id: string | null;
          match_score: number | null;
          match_reasoning: string | null;
          match_risks: string[] | null;
          caption: string | null;
          hashtags: string[] | null;
          shooting_guide: Json | null;
          carousel_plan: Json | null;
          reel_script: Json | null;
          scheduled_at: string | null;
          user_status: string;
          user_edits: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id?: string | null;
          playbook_id?: string | null;
          match_score?: number | null;
          match_reasoning?: string | null;
          match_risks?: string[] | null;
          caption?: string | null;
          hashtags?: string[] | null;
          shooting_guide?: Json | null;
          carousel_plan?: Json | null;
          reel_script?: Json | null;
          scheduled_at?: string | null;
          user_status?: string;
          user_edits?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string | null;
          playbook_id?: string | null;
          match_score?: number | null;
          match_reasoning?: string | null;
          match_risks?: string[] | null;
          caption?: string | null;
          hashtags?: string[] | null;
          shooting_guide?: Json | null;
          carousel_plan?: Json | null;
          reel_script?: Json | null;
          scheduled_at?: string | null;
          user_status?: string;
          user_edits?: Json | null;
          created_at?: string;
        };
        Relationships: never[];
      };
      content_calendar: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          plan: Json | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          plan?: Json | null;
          generated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          plan?: Json | null;
          generated_at?: string;
        };
        Relationships: never[];
      };
      llm_calls: {
        Row: {
          id: string;
          analysis_id: string | null;
          stage: string | null;
          model: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          cost_usd: number | null;
          duration_ms: number | null;
          cached: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          analysis_id?: string | null;
          stage?: string | null;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          duration_ms?: number | null;
          cached?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          analysis_id?: string | null;
          stage?: string | null;
          model?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          cost_usd?: number | null;
          duration_ms?: number | null;
          cached?: boolean;
          created_at?: string;
        };
        Relationships: never[];
      };
      analysis_deltas: {
        Row: {
          id: string;
          account_id: string | null;
          prev_analysis_id: string | null;
          curr_analysis_id: string | null;
          delta_summary: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          prev_analysis_id?: string | null;
          curr_analysis_id?: string | null;
          delta_summary?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string | null;
          prev_analysis_id?: string | null;
          curr_analysis_id?: string | null;
          delta_summary?: Json | null;
          created_at?: string;
        };
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
