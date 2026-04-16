import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `당신은 부동산 중개사의 인스타그램 주간 콘텐츠 캘린더를 설계하는 전략가입니다.
주어진 Playbook 라이브러리와 매물 목록을 기반으로 최적의 주간 콘텐츠 계획을 수립합니다.
반드시 유효한 JSON만 반환하세요.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const userClient = createUserClient(authHeader);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const adminClient = createAdminClient();
    const body = await req.json() as { week_start: string };
    const { week_start } = body;

    // 현재 사용자의 활성 매물 로드
    const { data: listings } = await adminClient
      .from("listings")
      .select("id, title, district, dong, complex_name, size_pyeong, price_info, features")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(10);

    // Playbook 라이브러리 로드
    const { data: playbooks } = await adminClient
      .from("playbooks")
      .select("id, code, name, category, avg_engagement_rate, is_recommended, timing")
      .eq("user_id", user.id)
      .order("avg_engagement_rate", { ascending: false })
      .limit(20);

    const weekStartDate = new Date(week_start);
    const weekDays = ["월", "화", "수", "목", "금", "토", "일"];
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      return { day: weekDays[i], date: d.toISOString().split("T")[0] };
    });

    const prompt = `
주간 시작일: ${week_start}
주간 날짜: ${weekDates.map((d) => `${d.day}(${d.date})`).join(", ")}

활성 매물 목록:
${(listings ?? []).map((l, i) => `${i + 1}. ${[l.district, l.dong, l.complex_name].filter(Boolean).join(" ")} ${l.size_pyeong ? `${l.size_pyeong}평` : ""} (ID: ${l.id})`).join("\n")}

Playbook 라이브러리:
${(playbooks ?? []).map((p) => `- ${p.code} "${p.name}" (${p.category}, 참여율 ${p.avg_engagement_rate ? (p.avg_engagement_rate * 100).toFixed(1) : "?"}%)`).join("\n")}

부동산 중개사 인스타그램 최적 전략:
- 주 3-5회 포스팅 권장
- 콘텐츠 믹스: 매물 광고 40% + 시세/정보 30% + 라이프스타일 20% + 전문성/인게이지먼트 10%
- 최적 포스팅 시간: 화·목·토 오전 8-10시, 오후 7-9시

위 정보를 기반으로 다음 JSON 구조의 주간 캘린더를 생성하세요:

{
  "week_start": "${week_start}",
  "total_posts": <정수>,
  "strategy_summary": "<이번 주 전략 한 문장>",
  "days": [
    {
      "date": "<YYYY-MM-DD>",
      "day": "<요일>",
      "posts": [
        {
          "time": "<HH:MM>",
          "category": "listing | market_info | lifestyle | authority | engagement",
          "playbook_code": "<Playbook 코드 또는 null>",
          "listing_id": "<매물 ID 또는 null>",
          "topic": "<포스팅 주제 한 줄>",
          "hook": "<오프닝 훅 문장>",
          "format": "photo | carousel | reel",
          "estimated_reach": "<예상 도달 범위: low|medium|high>"
        }
      ]
    }
  ]
}

포스팅이 없는 날은 posts 배열을 빈 배열로 설정.`;

    const { text, usage } = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4000,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("LLM이 JSON을 반환하지 않았습니다");

    const calendarPlan = JSON.parse(jsonMatch[0]);
    const costUsd = estimateCost("claude-opus-4-20250514", usage.input_tokens, usage.output_tokens);

    // 캘린더 저장 (기존 주차 데이터 upsert)
    const { error: upsertError } = await adminClient
      .from("content_calendar")
      .upsert({
        user_id: user.id,
        week_start,
        plan: calendarPlan,
        generated_at: new Date().toISOString(),
      }, { onConflict: "user_id,week_start" });

    if (upsertError) throw upsertError;

    // LLM 호출 로그
    await adminClient.from("llm_calls").insert({
      stage: "generate-calendar",
      model: "claude-opus-4-20250514",
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: costUsd,
    });

    return new Response(
      JSON.stringify({ plan: calendarPlan, cost_usd: costUsd }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-calendar error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
