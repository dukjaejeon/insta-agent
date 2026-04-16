import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";
import {
  OCR_SYSTEM,
  OCR_POST_DETAIL,
  OCR_PROFILE,
  OCR_GRID,
} from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScreenshotInput {
  storage_path: string;
  screenshot_type: "profile" | "grid" | "post_detail" | "reel";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createUserClient(authHeader);
    const adminClient = createAdminClient();

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      account_id: string | null;
      screenshots: ScreenshotInput[];
    };

    const { account_id, screenshots } = body;

    const extractedPosts: Record<string, unknown>[] = [];
    let profileData: Record<string, unknown> | null = null;
    let totalCostUsd = 0;

    for (const shot of screenshots) {
      // Storage에서 서명 URL 생성
      const { data: signedData, error: signError } = await adminClient.storage
        .from("screenshots")
        .createSignedUrl(shot.storage_path, 3600);

      if (signError || !signedData?.signedUrl) {
        console.error("서명 URL 생성 실패:", signError);
        continue;
      }

      // 이미지를 base64로 변환
      const imgResponse = await fetch(signedData.signedUrl);
      const imgBuffer = await imgResponse.arrayBuffer();
      const imgBase64 = btoa(
        String.fromCharCode(...new Uint8Array(imgBuffer))
      );
      const imgMediaType =
        imgResponse.headers.get("content-type") || "image/jpeg";

      // 스크린샷 타입별 프롬프트 선택
      let userPrompt: string;
      if (shot.screenshot_type === "profile") {
        userPrompt = OCR_PROFILE;
      } else if (shot.screenshot_type === "grid") {
        userPrompt = OCR_GRID;
      } else {
        userPrompt = OCR_POST_DETAIL;
      }

      const { text, usage } = await callClaude({
        system: OCR_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: imgMediaType,
                  data: imgBase64,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
        maxTokens: 2048,
      });

      const cost = estimateCost("claude-opus-4", usage.input_tokens, usage.output_tokens);
      totalCostUsd += cost;

      // JSON 파싱
      let parsed: Record<string, unknown>;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch {
        console.error("JSON 파싱 실패:", text.slice(0, 200));
        continue;
      }

      // LLM 호출 로그 (analysis_id가 없으므로 null)
      await adminClient.from("llm_calls").insert({
        analysis_id: null,
        stage: "ocr",
        model: "claude-opus-4",
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: cost,
        cached: false,
      });

      if (shot.screenshot_type === "profile") {
        profileData = parsed;
      } else {
        extractedPosts.push({
          ...parsed,
          _storage_path: shot.storage_path,
        });
      }
    }

    // account_id 있으면 posts 초안 저장
    if (account_id && extractedPosts.length > 0) {
      const inserts = extractedPosts.map((p) => ({
        account_id,
        media_type: p.media_type || "photo",
        slide_count: p.slide_count || 1,
        caption: p.caption || null,
        hashtags: p.hashtags || [],
        like_count: p.like_count || null,
        comment_count: p.comment_count || null,
        view_count: p.view_count || null,
        top_comments: p.top_comments || [],
        screenshot_paths: p._storage_path ? [p._storage_path] : [],
        ocr_raw_json: p,
        within_scope: true,
      }));

      await adminClient.from("benchmark_posts").insert(inserts);
    }

    return new Response(
      JSON.stringify({
        extracted_posts: extractedPosts,
        profile: profileData,
        total_cost_usd: totalCostUsd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ocr-extract-posts 오류:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
