/**
 * analyze-delta — 주기적 재분석 델타 비교
 *
 * 이전 분석과 현재 분석을 비교해:
 * - 새로 생긴 패턴 (new_patterns)
 * - 사라진 패턴 (lost_patterns)
 * - 참여율 변화 (engagement_change)
 * - 새 Viral 게시물 (new_viral_count)
 * 를 analysis_deltas 테이블에 저장하고 Realtime으로 브로드캐스트
 */
import { createAdminClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELTA_SYSTEM = `당신은 인스타그램 계정의 시계열 분석 전문가입니다.
이전 분석과 현재 분석을 비교해 의미있는 변화를 JSON으로 요약합니다.
반드시 유효한 JSON만 반환하세요.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const adminClient = createAdminClient();
    const body = await req.json() as { account_id: string };
    const { account_id } = body;

    // 가장 최근 완료된 분석 2개 조회
    const { data: analyses } = await adminClient
      .from("analyses")
      .select("*")
      .eq("account_id", account_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2);

    if (!analyses || analyses.length < 2) {
      return new Response(
        JSON.stringify({ message: "이전 분석이 없습니다. 최초 분석 후 델타가 생성됩니다." }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const [curr, prev] = analyses;

    // 이미 이 쌍의 델타가 있으면 스킵
    const { data: existing } = await adminClient
      .from("analysis_deltas")
      .select("id")
      .eq("account_id", account_id)
      .eq("curr_analysis_id", curr.id)
      .single();

    if (existing) {
      return new Response(
        JSON.stringify({ message: "이미 델타가 생성되었습니다", delta_exists: true }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Playbook 변화 감지
    const prevPlaybookIds = new Set(prev.playbook_ids ?? []);
    const currPlaybookIds = new Set(curr.playbook_ids ?? []);

    const newPlaybookIds = [...currPlaybookIds].filter((id) => !prevPlaybookIds.has(id));
    const lostPlaybookIds = [...prevPlaybookIds].filter((id) => !currPlaybookIds.has(id));

    const [newPlaybooks, lostPlaybooks] = await Promise.all([
      newPlaybookIds.length > 0
        ? adminClient.from("playbooks").select("code, name, category").in("id", newPlaybookIds)
        : { data: [] },
      lostPlaybookIds.length > 0
        ? adminClient.from("playbooks").select("code, name, category").in("id", lostPlaybookIds)
        : { data: [] },
    ]);

    // 포트폴리오 분포 변화
    const prevBreakdown = (prev.portfolio_breakdown ?? {}) as Record<string, number>;
    const currBreakdown = (curr.portfolio_breakdown ?? {}) as Record<string, number>;

    const portfolioChanges: Record<string, { prev: number; curr: number; delta: number }> = {};
    const allCategories = new Set([...Object.keys(prevBreakdown), ...Object.keys(currBreakdown)]);
    for (const cat of allCategories) {
      const p = prevBreakdown[cat] ?? 0;
      const c = currBreakdown[cat] ?? 0;
      if (Math.abs(c - p) > 0) {
        portfolioChanges[cat] = { prev: p, curr: c, delta: c - p };
      }
    }

    // Viral 수 변화
    const prevViralCount = ((prev.viral_highlights as unknown[]) ?? []).length;
    const currViralCount = ((curr.viral_highlights as unknown[]) ?? []).length;

    // 비용 변화
    const prevCost = prev.total_cost_usd ?? 0;
    const currCost = curr.total_cost_usd ?? 0;

    // LLM으로 델타 요약 생성
    const deltaContext = `
이전 분석 (${prev.completed_at}):
- Viral 게시물: ${prevViralCount}건
- 포트폴리오: ${JSON.stringify(prevBreakdown)}
- Playbook 수: ${(prev.playbook_ids ?? []).length}개
- 분석 비용: $${prevCost.toFixed(3)}

현재 분석 (${curr.completed_at}):
- Viral 게시물: ${currViralCount}건
- 포트폴리오: ${JSON.stringify(currBreakdown)}
- Playbook 수: ${(curr.playbook_ids ?? []).length}개
- 분석 비용: $${currCost.toFixed(3)}

변화 감지:
- 새 Playbook: ${JSON.stringify(newPlaybooks.data ?? [])}
- 소멸 Playbook: ${JSON.stringify(lostPlaybooks.data ?? [])}
- 포트폴리오 변화: ${JSON.stringify(portfolioChanges)}
- Viral 증감: ${currViralCount - prevViralCount > 0 ? "+" : ""}${currViralCount - prevViralCount}건`;

    const { text, usage } = await callClaude({
      system: DELTA_SYSTEM,
      messages: [{
        role: "user",
        content: `${deltaContext}\n\n위 변화를 분석해 다음 JSON 구조로 요약하세요:\n\n{\n  "headline": "<한 줄 핵심 변화 요약>",\n  "new_patterns": ["<새로 발견된 성공 패턴>"],\n  "lost_patterns": ["<더 이상 효과 없는 패턴>"],\n  "viral_change": <정수, 양수=증가 음수=감소>,\n  "portfolio_shift": "<포트폴리오 비중 변화 핵심>",\n  "recommendation": "<다음 분석 주기까지 추천 액션>"\n}`
      }],
      maxTokens: 1024,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const summary = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    const costUsd = estimateCost("claude-opus-4-20250514", usage.input_tokens, usage.output_tokens);

    // 델타 저장
    const deltaData = {
      ...summary,
      new_playbooks: newPlaybooks.data ?? [],
      lost_playbooks: lostPlaybooks.data ?? [],
      portfolio_changes: portfolioChanges,
      prev_analysis_date: prev.completed_at,
      curr_analysis_date: curr.completed_at,
      cost_usd: costUsd,
    };

    const { data: delta } = await adminClient
      .from("analysis_deltas")
      .insert({
        account_id,
        prev_analysis_id: prev.id,
        curr_analysis_id: curr.id,
        delta_summary: deltaData,
      })
      .select("id")
      .single();

    // LLM 호출 로그
    await adminClient.from("llm_calls").insert({
      analysis_id: curr.id,
      stage: "delta",
      model: "claude-opus-4-20250514",
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: costUsd,
    });

    return new Response(
      JSON.stringify({ delta_id: delta?.id, summary: deltaData }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("analyze-delta error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
