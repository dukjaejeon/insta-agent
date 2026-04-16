-- ============================================
-- 1. 사용자 프로필 (auth.users 확장)
-- ============================================
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  business_name text,
  business_phone text,
  license_number text,
  default_locations text[] default array['도봉구','노원구','강북구','의정부'],
  brand_colors jsonb default '{"sage": "#87A96B", "charcoal": "#2D3436", "cream": "#F7F6F2"}'::jsonb,
  brand_fonts jsonb default '{"primary": "Pretendard", "secondary": "Inter"}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- 2. 벤치마크 계정 메타
-- ============================================
create table benchmark_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  handle text not null,
  display_name text,
  bio text,
  follower_count int,
  following_count int,
  post_count int,
  category text,
  is_niche_account boolean default false,
  tracking_enabled boolean default true,
  tracking_cadence text default 'weekly',
  last_analyzed_at timestamptz,
  highlight_post_ids text[],
  created_at timestamptz default now()
);

-- ============================================
-- 3. 벤치마크 게시물
-- ============================================
create table benchmark_posts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references benchmark_accounts(id) on delete cascade,
  external_url text,
  media_type text,
  slide_count int default 1,
  caption text,
  hashtags text[],
  posted_at timestamptz,
  like_count int,
  comment_count int,
  view_count int,
  screenshot_paths text[],
  top_comments jsonb,
  tier text,
  tier_signals jsonb,
  tier_manual_override text,
  is_from_highlight boolean default false,
  within_scope boolean default true,
  ocr_raw_json jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- 4. 게시물 분류
-- ============================================
create table post_classifications (
  post_id uuid references benchmark_posts(id) on delete cascade primary key,
  primary_category text,
  secondary_category text,
  confidence float,
  tags text[],
  classified_at timestamptz default now()
);

-- ============================================
-- 5. 성과 지표
-- ============================================
create table post_performance (
  post_id uuid references benchmark_posts(id) on delete cascade primary key,
  engagement_rate float,
  percentile_within_category float,
  is_top_performer boolean default false,
  engagement_multiple float,
  view_multiple float,
  save_signals int,
  share_signals int,
  comment_depth_score float,
  computed_at timestamptz default now()
);

-- ============================================
-- 6. Viral 부검 리포트
-- ============================================
create table viral_autopsies (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references benchmark_posts(id) on delete cascade unique,
  first_3sec_breakdown jsonb,
  hook_anatomy jsonb,
  emotion_curve jsonb,
  info_density jsonb,
  topicality_anchor jsonb,
  comment_reaction_pattern jsonb,
  algorithm_signals jsonb,
  scarcity_exclusivity jsonb,
  visual_impact_score float,
  replicability jsonb,
  why_viral_replicable text[],
  why_viral_situational text[],
  application_warnings text[],
  total_cost_usd numeric(10, 4),
  created_at timestamptz default now()
);

-- ============================================
-- 7. Playbook 라이브러리
-- ============================================
create table playbooks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  source_account_id uuid references benchmark_accounts(id),
  code text not null,
  name text not null,
  category text,
  evidence_post_ids uuid[],
  viral_autopsy_ids uuid[],
  derived_from_viral boolean default false,
  avg_engagement_rate float,
  visual jsonb not null,
  copy jsonb not null,
  format jsonb not null,
  hashtags jsonb not null,
  timing jsonb,
  is_recommended boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- 8. 톤·어휘 프로파일
-- ============================================
create table voice_profiles (
  id uuid default gen_random_uuid() primary key,
  source_account_id uuid references benchmark_accounts(id) unique,
  ending_ratio jsonb,
  vocabulary_high_freq text[],
  vocabulary_banned text[],
  signature_phrases_blacklist text[],
  emoji_usage jsonb,
  honorific_distance text,
  structural_signatures text[],
  created_at timestamptz default now()
);

-- ============================================
-- 9. 분석 이력
-- ============================================
create table analyses (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references benchmark_accounts(id) on delete cascade,
  analysis_type text,
  portfolio_breakdown jsonb,
  top_patterns jsonb,
  viral_highlights jsonb,
  playbook_ids uuid[],
  voice_profile_id uuid references voice_profiles(id),
  total_cost_usd numeric(10, 4),
  llm_call_count int,
  status text default 'pending',
  error_log text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================
-- 10. 내 매물
-- ============================================
create table listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  title text,
  district text,
  dong text,
  complex_name text,
  size_pyeong int,
  size_sqm int,
  floor int,
  direction text,
  price_info jsonb,
  features text[],
  raw_memo text,
  photo_paths text[],
  status text default 'draft',
  created_at timestamptz default now()
);

-- ============================================
-- 11. 콘텐츠 제안 (매물 + Playbook)
-- ============================================
create table proposals (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references listings(id) on delete cascade,
  playbook_id uuid references playbooks(id),
  match_score float,
  match_reasoning text,
  match_risks text[],
  caption text,
  hashtags text[],
  shooting_guide jsonb,
  carousel_plan jsonb,
  reel_script jsonb,
  scheduled_at timestamptz,
  user_status text default 'pending',
  user_edits jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- 12. 콘텐츠 캘린더
-- ============================================
create table content_calendar (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  week_start date not null,
  plan jsonb,
  generated_at timestamptz default now()
);

-- ============================================
-- 13. LLM 호출 로그 (비용 추적)
-- ============================================
create table llm_calls (
  id uuid default gen_random_uuid() primary key,
  analysis_id uuid references analyses(id) on delete set null,
  stage text,
  model text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  duration_ms int,
  cached boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- RLS 활성화
-- ============================================
alter table profiles enable row level security;
alter table benchmark_accounts enable row level security;
alter table benchmark_posts enable row level security;
alter table post_classifications enable row level security;
alter table post_performance enable row level security;
alter table viral_autopsies enable row level security;
alter table playbooks enable row level security;
alter table voice_profiles enable row level security;
alter table analyses enable row level security;
alter table listings enable row level security;
alter table proposals enable row level security;
alter table content_calendar enable row level security;
alter table llm_calls enable row level security;

-- ============================================
-- RLS 정책 — 직접 user_id 가진 테이블
-- ============================================
create policy "users access own profile" on profiles for all using (auth.uid() = id);
create policy "users access own accounts" on benchmark_accounts for all using (auth.uid() = user_id);
create policy "users access own playbooks" on playbooks for all using (auth.uid() = user_id);
create policy "users access own listings" on listings for all using (auth.uid() = user_id);
create policy "users access own calendar" on content_calendar for all using (auth.uid() = user_id);

-- ============================================
-- RLS 정책 — JOIN 기반 (benchmark_accounts 경유)
-- ============================================
create policy "users access own posts" on benchmark_posts for all using (
  account_id in (select id from benchmark_accounts where user_id = auth.uid())
);
create policy "users access own classifications" on post_classifications for all using (
  post_id in (select bp.id from benchmark_posts bp join benchmark_accounts ba on bp.account_id = ba.id where ba.user_id = auth.uid())
);
create policy "users access own performance" on post_performance for all using (
  post_id in (select bp.id from benchmark_posts bp join benchmark_accounts ba on bp.account_id = ba.id where ba.user_id = auth.uid())
);
create policy "users access own autopsies" on viral_autopsies for all using (
  post_id in (select bp.id from benchmark_posts bp join benchmark_accounts ba on bp.account_id = ba.id where ba.user_id = auth.uid())
);
create policy "users access own voice profiles" on voice_profiles for all using (
  source_account_id in (select id from benchmark_accounts where user_id = auth.uid())
);
create policy "users access own analyses" on analyses for all using (
  account_id in (select id from benchmark_accounts where user_id = auth.uid())
);

-- ============================================
-- RLS 정책 — listings 경유
-- ============================================
create policy "users access own proposals" on proposals for all using (
  listing_id in (select id from listings where user_id = auth.uid())
);

-- ============================================
-- RLS 정책 — analyses 경유
-- ============================================
create policy "users access own llm logs" on llm_calls for all using (
  analysis_id in (select a.id from analyses a join benchmark_accounts ba on a.account_id = ba.id where ba.user_id = auth.uid())
);

-- ============================================
-- 인덱스
-- ============================================
create index idx_posts_account on benchmark_posts(account_id);
create index idx_posts_posted_at on benchmark_posts(posted_at desc);
create index idx_posts_tier on benchmark_posts(tier) where within_scope = true;
create index idx_posts_within_scope on benchmark_posts(account_id, within_scope);
create index idx_posts_from_highlight on benchmark_posts(account_id, is_from_highlight) where is_from_highlight = true;
create index idx_autopsies_post on viral_autopsies(post_id);
create index idx_playbooks_user on playbooks(user_id);
create index idx_playbooks_category on playbooks(category);
create index idx_playbooks_from_viral on playbooks(derived_from_viral) where derived_from_viral = true;
create index idx_listings_user on listings(user_id);
create index idx_proposals_listing on proposals(listing_id);
create index idx_calendar_week on content_calendar(user_id, week_start);
create index idx_llm_calls_analysis on llm_calls(analysis_id);
create index idx_llm_calls_stage on llm_calls(stage, created_at);

-- ============================================
-- Storage 버킷
-- ============================================
insert into storage.buckets (id, name, public) values ('screenshots', 'screenshots', false);
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', false);

-- Storage 접근 정책
create policy "users upload own screenshots" on storage.objects
  for insert with check (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users read own screenshots" on storage.objects
  for select using (bucket_id = 'screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users upload own listing photos" on storage.objects
  for insert with check (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users read own listing photos" on storage.objects
  for select using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);
