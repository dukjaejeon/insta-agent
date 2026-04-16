import { createAdminClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `당신은 부동산 인스타그램 콘텐츠 전략가입니다.
주어진 매물 정보와 Playbook을 결합해 즉시 사용 가능한 콘텐츠 제안을 생성합니다.
매물의 특성을 Playbook 공식에 맞게 자연스럽게 녹여야 합니다.
반드시 유효한 JSON만 반환하세요.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const adminClient = createAdminClient();
    const body = await req.json() as { listing_id: string; playbook_id?: string | null };
    const { listing_id, playbook_id } = body;

    // 매물 로드
    const { data: listing, error: listingError } = await adminClient
      .from("listings")
      .select("*")
      .eq("id", listing_id)
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Playbook 로드 (지정 또는 최고 참여율)
    let playbook = null;
    if (playbook_id) {
      const { data } = await adminClient.from("playbooks").select("*").eq("id", playbook_id).single();
      playbook = data;
    } else {
      // 카테고리 listing의 추천 또는 최고 참여율 Playbook
      const { data } = await adminClient
        .from("playbooks")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", "listing")
        .order("avg_engagement_rate", { ascending: false })
        .limit(1)
        .single();
      playbook = data;

      // listing 카테고리가 없으면 아무 추천 Playbook
      if (!playbook) {
        const { data: anyPb } = await adminClient
          .from("playbooks")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_recommended", true)
          .limit(1)
          .single();
        playbook = anyPb;
      }
    }

    // 매물 정보 + Playbook 기반 프롬프트 구성
    const priceInfo = listing.price_info as Record<string, unknown> | null;
    const features = listing.features ?? [];

    const listingContext = `
매물 정보:
- 위치: ${[listing.district, listing.dong, listing.complex_name].filter(Boolean).join(" ")}
- 크기: ${listing.size_pyeong ? `${listing.size_pyeong}평` : "미정"}
- 층수: ${listing.floor ? `${listing.floor}층` : "미정"}
- 방향: ${listing.direction ?? "미정"}
- 가격: ${priceInfo ? JSON.stringify(priceInfo) : "미정"}
- 특징: ${features.length > 0 ? features.join(", ") : "없음"}
- 메모: ${listing.raw_memo ?? "없음"}`;

    const playbookContext = playbook
      ? `
적용할 Playbook (${playbook.code} - ${playbook.name}):
- 카테고리: ${playbook.category}
- 비주얼 공식: ${JSON.stringify(playbook.visual)}
- 카피 공식: ${JSON.stringify(playbook.copy)}
- 포맷 공식: ${JSON.stringify(playbook.format)}
- 해시태그 공식: ${JSON.stringify(playbook.hashtags)}`
      : "Playbook 없음 (일반적인 부동산 인스타그램 공식 적용)";

    const userPrompt = `${listingContext}

${playbookContext}

위 매물 정보와 Playbook 공식을 조합해 다음 JSON 구조로 콘텐츠 제안을 생성하세요:

{
  "match_score": <0.0-1.0, Playbook이 이 매물에 얼마나 잘 맞는지>,
  "match_reasoning": "<왜 이 Playbook이 이 매물에 적합한지 한 문장>",
  "match_risks": ["<적용 시 주의사항>"],
  "caption": "<완성된 인스타그램 캡션, 줄바꿈 \\n 포함, 해시태그 제외>",
  "hashtags": ["해시태그1", "해시태그2", ...],
  "shooting_guide": {
    "angles": ["앵글1", "앵글2"],
    "lighting": "<조명 가이드>",
    "props": ["소품1", "소품2"],
    "timing": "<최적 촬영 시간대>",
    "notes": "<주의사항>"
  },
  "carousel_plan": {
    "cover_caption": "<커버 슬라이드 텍스트>",
    "slides": [
      { "order": 1, "title": "<슬라이드 제목>", "body": "<본문>", "visual_note": "<비주얼 참고>" },
      ...
    ]
  },
  "reel_script": {
    "hook_text": "<첫 3초 오프닝 텍스트>",
    "scenes": [
      { "duration": "0-3초", "action": "<행동 묘사>", "text_overlay": "<화면 텍스트>" },
      ...
    ],
    "background_music": "<BGM 제안>",
    "caption": "<릴스 캡션>"
  },
  "scheduled_at": "<제안 포스팅 일시 ISO 형식, 다음 최적 시간대>"
}`;

    const { text, usage } = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 6000,
    });

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("LLM이 JSON을 반환하지 않았습니다");

    const proposal = JSON.parse(jsonMatch[0]);
    const costUsd = estimateCost("claude-opus-4-6", usage.input_tokens, usage.output_tokens);

    // DB에 제안 저장
    const { data: savedProposal, error: insertError } = await adminClient
      .from("proposals")
      .insert({
        listing_id,
        playbook_id: playbook?.id ?? null,
        match_score: proposal.match_score ?? null,
        match_reasoning: proposal.match_reasoning ?? null,
        match_risks: proposal.match_risks ?? [],
        caption: proposal.caption ?? null,
        hashtags: proposal.hashtags ?? [],
        shooting_guide: proposal.shooting_guide ?? null,
        carousel_plan: proposal.carousel_plan ?? null,
        reel_script: proposal.reel_script ?? null,
        scheduled_at: proposal.scheduled_at ?? null,
        user_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // LLM 호출 로그
    await adminClient.from("llm_calls").insert({
      stage: "match-and-propose",
      model: "claude-opus-4-6",
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: costUsd,
    });

    return new Response(
      JSON.stringify({ proposal_id: savedProposal?.id, cost_usd: costUsd }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("match-and-propose error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
