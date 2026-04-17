import { createAdminClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklySuggestion {
  day: string;
  format: string;
  topic: string;
  caption: string;
  hashtags: string[];
  basis: string;
}

async function tavilySearch(query: string): Promise<string> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return "(뉴스 검색 생략 — TAVILY_API_KEY 없음)";

  try {
    const resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
    });
    if (!resp.ok) return "(뉴스 검색 실패)";
    const data = await resp.json() as { results?: Array<{ title: string; content: string }> };
    return (data.results ?? [])
      .map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`)
      .join("\n");
  } catch {
    return "(뉴스 검색 오류)";
  }
}

async function sendDiscord(webhookUrl: string, suggestions: WeeklySuggestion[]): Promise<void> {
  const FORMAT_LABEL: Record<string, string> = {
    carousel: "카드뉴스", reel: "릴스", photo: "사진",
  };

  const lines = suggestions
    .map((s, i) =>
      [
        `**[${i + 1}] ${s.day}요일 · ${FORMAT_LABEL[s.format] ?? s.format}**`,
        `📌 ${s.topic}`,
        "",
        s.caption.slice(0, 350) + (s.caption.length > 350 ? "…" : ""),
        "",
        `📊 *근거: ${s.basis}*`,
      ].join("\n")
    )
    .join("\n\n──────────────\n\n");

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `📅 **이번 주 인스타그램 콘텐츠 추천 (오늘부동산)**\n\n${lines}`,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json() as { user_id: string; send_discord?: boolean };
    const { user_id, send_discord = false } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id 필요" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createAdminClient();

    // ── 1. 사용자의 Playbook 로드 ──────────────────────
    const { data: playbooks } = await adminClient
      .from("playbooks")
      .select("id, code, name, copy_formula, best_format, hashtag_set, source_account_id, avg_engagement_rate")
      .eq("user_id", user_id)
      .order("avg_engagement_rate", { ascending: false })
      .limit(10);

    if (!playbooks || playbooks.length === 0) {
      return new Response(
        JSON.stringify({
          error: "분석된 Playbook이 없습니다. 먼저 벤치마크 계정을 1개 이상 분석해주세요.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. 벤치마크 계정 핸들 매핑 ────────────────────
    const accountIds = [
      ...new Set(
        (playbooks ?? [])
          .map((p) => p.source_account_id as string | null)
          .filter(Boolean) as string[]
      ),
    ];

    const accountMap: Record<string, string> = {};
    if (accountIds.length > 0) {
      const { data: accounts } = await adminClient
        .from("benchmark_accounts")
        .select("id, handle, follower_count")
        .in("id", accountIds);
      for (const a of accounts ?? []) {
        accountMap[a.id] = a.handle ?? "알 수 없음";
      }
    }

    // ── 3. 이번 주 부동산 뉴스 (Tavily) ───────────────
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    });
    const newsText = await tavilySearch(
      "부동산 아파트 매매 전세 시장 동향 정책 이번 주 뉴스 2024 2025"
    );

    // ── 4. Playbook 요약 ───────────────────────────────
    const playbookSummary = (playbooks ?? [])
      .map((pb) => {
        const handle = pb.source_account_id
          ? (accountMap[pb.source_account_id as string] ?? "알 수 없음")
          : "알 수 없음";
        const engagement = pb.avg_engagement_rate
          ? `참여율 ${(Number(pb.avg_engagement_rate) * 100).toFixed(1)}%`
          : "";
        return [
          `[${pb.code}] ${pb.name} (출처: ${handle}, ${engagement})`,
          `공식: ${pb.copy_formula ?? "없음"}`,
          `추천 포맷: ${pb.best_format ?? "사진"}`,
          `해시태그: ${((pb.hashtag_set as string[]) ?? []).slice(0, 5).join(" ")}`,
        ].join("\n");
      })
      .join("\n\n");

    // ── 5. Claude로 이번 주 3개 콘텐츠 생성 ───────────
    const systemPrompt = `당신은 부동산 인스타그램 콘텐츠 전략가입니다.
경쟁 계정의 성공 패턴(Playbook)과 최신 뉴스를 결합해서, 오늘부동산중개법인의 이번 주 인스타그램 게시물 3개를 기획합니다.

계정 정보:
- 계정주: 전덕재 대표 (공인중개사)
- 회사: 오늘부동산중개법인 주식회사
- 위치: 서울 도봉구 도봉로 (도봉구 전문)
- 타겟: 30~50대 부동산 거래 준비자
- 톤: 전문적이면서 친근하고 신뢰감 있는

반드시 JSON만 반환하세요. 코드블록 없이, 설명 텍스트 없이.`;

    const userPrompt = `오늘: ${today}

=== 경쟁 계정 성공 패턴 (Playbook) ===
${playbookSummary}

=== 이번 주 부동산 뉴스 ===
${newsText}

위 Playbook 공식과 뉴스를 반드시 결합해서, 이번 주 월·수·금에 올릴 게시물 3개를 JSON으로 제안하세요.
각 제안은 실제로 올릴 수 있는 완성 캡션이어야 합니다.

{
  "suggestions": [
    {
      "day": "월",
      "format": "carousel",
      "topic": "독자 관점에서 궁금할 주제 (1줄 제목)",
      "caption": "즉시 복사해서 인스타에 올릴 수 있는 완성된 캡션. 이모지 포함. 줄바꿈 포함. 300~500자. 실제 도봉구 내용 포함.",
      "hashtags": ["#도봉구부동산", "#공인중개사", "#오늘부동산", ...최소8개],
      "basis": "어떤 Playbook 공식을 왜 적용했는지 + 뉴스와 어떻게 연결되는지 + 예상 효과 (2~3줄, 구체적인 수치 포함)"
    },
    { "day": "수", ... },
    { "day": "금", ... }
  ]
}`;

    const model = "claude-sonnet-4-6";
    const { text, usage } = await callClaude({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 3500,
    });

    // ── 비용 로그 ──────────────────────────────────────
    const costUsd = estimateCost(model, usage.input_tokens, usage.output_tokens);
    try {
      await adminClient.from("llm_calls").insert({
        stage: "generate-weekly-brief",
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: costUsd,
        cached: false,
      });
    } catch { /* 로그 실패 무시 */ }

    // ── JSON 파싱 ──────────────────────────────────────
    let suggestions: WeeklySuggestion[] = [];
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as { suggestions?: WeeklySuggestion[] };
        suggestions = parsed.suggestions ?? [];
      }
    } catch {
      suggestions = [];
    }

    // ── Discord 전송 ───────────────────────────────────
    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (send_discord && webhookUrl && suggestions.length > 0) {
      try {
        await sendDiscord(webhookUrl, suggestions);
      } catch (e) {
        console.error("Discord 전송 실패:", e);
      }
    }

    return new Response(
      JSON.stringify({ suggestions, cost_usd: costUsd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-weekly-brief 오류:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
