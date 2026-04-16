-- ============================================
-- pg_cron 기반 주기적 재분석 스케줄러
-- Supabase 대시보드 > Database > Extensions 에서
-- pg_cron 활성화 필요
-- ============================================

-- pg_cron 확장 활성화 (이미 활성화되어 있을 경우 무시)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================
-- 재분석 대상 계정 조회 함수
-- ============================================
create or replace function get_accounts_due_for_reanalysis()
returns table(account_id uuid, user_id uuid, handle text, tracking_cadence text)
language sql
security definer
as $$
  select
    id as account_id,
    user_id,
    handle,
    tracking_cadence
  from benchmark_accounts
  where tracking_enabled = true
    and (
      -- 마지막 분석이 없거나, 케이던스에 따라 기한이 지난 경우
      last_analyzed_at is null
      or (
        tracking_cadence = 'weekly'
        and last_analyzed_at < now() - interval '7 days'
      )
      or (
        tracking_cadence = 'biweekly'
        and last_analyzed_at < now() - interval '14 days'
      )
      or (
        tracking_cadence = 'monthly'
        and last_analyzed_at < now() - interval '30 days'
      )
    );
$$;

-- ============================================
-- 주기적 재분석 트리거 함수
-- (pg_net으로 Edge Function 호출)
-- ============================================
create or replace function trigger_scheduled_reanalysis()
returns void
language plpgsql
security definer
as $$
declare
  account_row record;
  supabase_url text;
  service_role_key text;
begin
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  for account_row in select * from get_accounts_due_for_reanalysis() loop
    -- Edge Function 비동기 호출
    perform net.http_post(
      url := supabase_url || '/functions/v1/analyze-account',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'account_id', account_row.account_id,
        'analysis_type', 'delta'
      )
    );

    -- 마지막 분석 시각 업데이트 (중복 트리거 방지)
    update benchmark_accounts
    set last_analyzed_at = now()
    where id = account_row.account_id;
  end loop;
end;
$$;

-- ============================================
-- cron 스케줄 등록
-- 매일 새벽 3시 (KST = UTC+9, 즉 UTC 18:00)
-- ============================================
select cron.schedule(
  'daily-reanalysis',
  '0 18 * * *',  -- 매일 UTC 18:00 = KST 03:00
  $$select trigger_scheduled_reanalysis()$$
);

-- ============================================
-- 분석 델타 추적 테이블
-- ============================================
create table if not exists analysis_deltas (
  id uuid default gen_random_uuid() primary key,
  account_id uuid references benchmark_accounts(id) on delete cascade,
  prev_analysis_id uuid references analyses(id),
  curr_analysis_id uuid references analyses(id),
  delta_summary jsonb,  -- { "new_patterns": [], "lost_patterns": [], "engagement_change": +0.02 }
  created_at timestamptz default now()
);

alter table analysis_deltas enable row level security;
create policy "users access own deltas" on analysis_deltas for all using (
  account_id in (select id from benchmark_accounts where user_id = auth.uid())
);

create index idx_deltas_account on analysis_deltas(account_id, created_at desc);
