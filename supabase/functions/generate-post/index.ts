import { createAdminClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 요청 파싱
    let body: { playbook_id: string; topic: string; user_id: string };
    try {
      body = await req.json() as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: "요청 형식 오류" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { playbook_id, topic, user_id } = body;

    if (!playbook_id || !topic) {
      return new Response(JSON.stringify({ error: "playbook_id와 topic은 필수입니다" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createAdminClient();

    // Playbook 로드
    let playbook: Record<string, unknown> | null = null;
    try {
      const { data, error } = await adminClient
        .from("playbooks")
        .select("*")
        .eq("id", playbook_id)
        .single();
      if (error) throw error;
      playbook = data as Record<string, unknown>;
    } catch (e) {
      console.error("playbook 조회 실패:", e);
      return new Response(JSON.stringify({ error: "Playbook을 찾을 수 없습니다" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Voice Profile 로드 (없어도 됨)
    let voiceProfile: Record<string, unknown> | null = null;
    const sourceAccountId = playbook.source_account_id as string | null;
    if (sourceAccountId) {
      try {
        const { data } = await adminClient
          .from("voice_profiles")
          .select("*")
          .eq("source_account_id", sourceAccountId)
          .single();
        voiceProfile = data as Record<string, unknown> | null;
      } catch {
        // voice_profiles 없어도 계속 진행
      }
    }

    const model = "claude-sonnet-4-6";

    const systemPrompt =
      "당신은 부동산 인스타그램 콘텐츠 작가입니다. Playbook 공식과 Voice Profile을 따라 즉시 게시 가능한 캡션을 작성하세요. 반드시 JSON으로 반환하세요.";

    const voiceProfileText = voiceProfile
      ? JSON.stringify(voiceProfile, null, 2)
      : "없음";

    const userPrompt =
      `Playbook: ${JSON.stringify(playbook, null, 2)}\n\nVoice Profile: ${voiceProfileText}\n\n주제: ${topic}\n\n다음 JSON 형식으로 캡션을 작성하세요:\n{"caption": "전체 캡션", "hashtags": ["해시태그1"], "tip": "이 공식을 쓴 이유 1줄"}`;

    // Claude Sonnet으로 캡션 생성
    const { text, usage } = await callClaude({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 1500,
    });

    const costUsd = estimateCost(model, usage.input_tokens, usage.output_tokens);

    // LLM 호출 로그 (실패해도 무시)
    try {
      await adminClient.from("llm_calls").insert({
        stage: "generate-post",
        model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: costUsd,
        cached: false,
      });
    } catch { /* LLM 로그 실패 무시 */ }

    // JSON 파싱
    let parsed: { caption?: string; hashtags?: string[]; tip?: string } = {};
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
      }
    } catch {
      // JSON 파싱 실패 시 텍스트 그대로 사용
      parsed = { caption: text, hashtags: [], tip: "" };
    }

    // listings 생성 기록 (user_id 있을 때만, 실패해도 무시)
    if (user_id) {
      try {
        await adminClient.from("generated_posts").insert({
          user_id,
          playbook_id,
          topic,
          caption: parsed.caption ?? "",
          hashtags: parsed.hashtags ?? [],
          tip: parsed.tip ?? "",
          cost_usd: costUsd,
        });
      } catch { /* 저장 실패 무시 */ }
    }

    return new Response(
      JSON.stringify({
        caption: parsed.caption ?? "",
        hashtags: parsed.hashtags ?? [],
        tip: parsed.tip ?? "",
        cost_usd: costUsd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-post 오류:", err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
