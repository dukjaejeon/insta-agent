import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createUserClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";
import {
  CLASSIFY_POSTS,
  DECOMPOSE_STANDARD,
  SYNTHESIZE_PLAYBOOK,
  EXTRACT_VOICE,
  VIRAL_AUTOPSY,
  COMMENT_CLASSIFY,
  OCR_SYSTEM,
} from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createUserClient(authHeader);
  const adminClient = createAdminClient();

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { account_id, analysis_type = "initial" } = await req.json() as {
    account_id: string;
    analysis_type: string;
    new_post_ids?: string[];
  };

  // analyses 레코드 생성
  const { data: analysis, error: analysisErr } = await adminClient
    .from("analyses")
    .insert({
      account_id,
      analysis_type,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (analysisErr || !analysis) {
    return new Response(JSON.stringify({ error: "Failed to create analysis record" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const analysisId = analysis.id;

  // Realtime 브로드캐스트 헬퍼
  const broadcast = async (stage: string, status: string) => {
    await adminClient
      .channel(`analysis:${analysisId}`)
      .send({ type: "broadcast", event: "progress", payload: { stage, status } })
      .catch(() => {});
  };

  // LLM 호출 로그 헬퍼
  const logLlm = async (stage: string, model: string, inputTokens: number, outputTokens: number, costUsd: number) => {
    await adminClient.from("llm_calls").insert({
      analysis_id: analysisId,
      stage,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      cached: false,
    });
  };

  let totalCostUsd = 0;
  let llmCallCount = 0;

  try {
    // 분석 대상 게시물 로드
    const { data: posts } = await adminClient
      .from("benchmark_posts")
      .select("*")
      .eq("account_id", account_id)
      .eq("within_scope", true);

    if (!posts || posts.length === 0) {
      throw new Error("분석할 게시물이 없습니다 (within_scope=true 인 게시물 필요)");
    }

    // 하이라이트 → 자동 Viral 후보
    await adminClient
      .from("benchmark_posts")
      .update({ tier_manual_override: "viral" })
      .eq("account_id", account_id)
      .eq("is_from_highlight", true)
      .is("tier_manual_override", null);

    // ============================================
    // STAGE 1: classify
    // ============================================
    await broadcast("classify", "running");

    const BATCH = 5;
    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH);
      const batchText = batch.map((p, idx) =>
        `[${idx}] caption: ${(p.caption || "").slice(0, 300)}\nhashtags: ${(p.hashtags || []).join(" ")}`
      ).join("\n\n---\n\n");

      const { text, usage } = await callClaude({
        system: CLASSIFY_POSTS,
        messages: [{ role: "user", content: `다음 ${batch.length}개 게시물을 각각 분류하세요. 배열 JSON으로 반환:\n\n${batchText}` }],
        maxTokens: 1024,
      });

      const cost = estimateCost("claude-opus-4", usage.input_tokens, usage.output_tokens);
      totalCostUsd += cost;
      llmCallCount++;
      await logLlm("classify", "claude-opus-4", usage.input_tokens, usage.output_tokens, cost);

      try {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        for (let j = 0; j < batch.length; j++) {
          const r = results[j] || {};
          await adminClient.from("post_classifications").upsert({
            post_id: batch[j].id,
            primary_category: r.primary_category || "listing",
            secondary_category: r.secondary_category || null,
            confidence: r.confidence || 0.5,
            tags: r.tags || [],
          });
        }
      } catch { /* 파싱 실패 시 스킵 */ }
    }

    await broadcast("classify", "completed");

    // ============================================
    // STAGE 2: rank (Tier 배정)
    // ============================================
    await broadcast("rank", "running");

    const { data: account } = await adminClient
      .from("benchmark_accounts")
      .select("follower_count")
      .eq("id", account_id)
      .single();

    const followerCount = account?.follower_count || 1000;
    const avgEng = posts.reduce((sum, p) =>
      sum + ((p.like_count || 0) + (p.comment_count || 0)) / followerCount, 0) / posts.length;

    for (const post of posts) {
      const engRate = ((post.like_count || 0) + (p_comment(post))) / followerCount;
      const signals: string[] = [];

      if (post.tier_manual_override === "viral") {
        await upsertPerformance(adminClient, post.id, engRate, avgEng, signals, "viral", followerCount);
        continue;
      }

      if (post.is_from_highlight) signals.push("highlight_pick");
      if (engRate >= avgEng * 3) signals.push("engagement_3x");
      if (post.media_type === "reel" && (post.view_count || 0) >= followerCount * 5) signals.push("view_5x");

      // 댓글 분류 (Haiku)
      if (post.top_comments && Array.isArray(post.top_comments) && post.top_comments.length > 0) {
        const commentTexts = (post.top_comments as Array<{ text: string }>).map((c) => c.text);
        try {
          const { text: cText, usage: cUsage } = await callClaude({
            model: "claude-haiku-4-5-20251001",
            system: COMMENT_CLASSIFY,
            messages: [{ role: "user", content: JSON.stringify(commentTexts) }],
            maxTokens: 512,
          });
          const cost = estimateCost("claude-haiku", cUsage.input_tokens, cUsage.output_tokens);
          totalCostUsd += cost;
          llmCallCount++;
          await logLlm("rank", "claude-haiku", cUsage.input_tokens, cUsage.output_tokens, cost);

          const cJson = JSON.parse((cText.match(/\{[\s\S]*\}/) || ["{}"])[0]);
          if ((cJson.save_signals || 0) >= 2) signals.push("save_3x");
          if ((cJson.share_signals || 0) >= 2) signals.push("share_3x");
        } catch { /* 스킵 */ }
      }

      const tier = signals.length >= 1 ? "viral" : engRate >= avgEng * 1.5 ? "high_performer" : "standard";
      await upsertPerformance(adminClient, post.id, engRate, avgEng, signals, tier, followerCount);

      await adminClient.from("benchmark_posts")
        .update({ tier, tier_signals: signals })
        .eq("id", post.id);
    }

    await broadcast("rank", "completed");

    // ============================================
    // STAGE 3: autopsy (Viral 부검)
    // ============================================
    await broadcast("autopsy", "running");

    const { data: viralPosts } = await adminClient
      .from("benchmark_posts")
      .select("*")
      .eq("account_id", account_id)
      .eq("tier", "viral")
      .eq("within_scope", true);

    for (const vp of (viralPosts || [])) {
      try {
        const captionText = vp.caption || "";
        const commentsList = Array.isArray(vp.top_comments) ? vp.top_comments : [];
        const commentsText = commentsList.slice(0, 20).map((c: { author: string; text: string }, i: number) =>
          `[${i}] @${c.author}: ${c.text}`
        ).join("\n");

        const userContent = [
          { type: "text", text: `캡션:\n${captionText}\n\n댓글:\n${commentsText}\n\n메타데이터: likes=${vp.like_count}, comments=${vp.comment_count}, views=${vp.view_count}, media_type=${vp.media_type}` }
        ];

        // 스크린샷 있으면 첨부
        if (vp.screenshot_paths && vp.screenshot_paths.length > 0) {
          const { data: signedData } = await adminClient.storage
            .from("screenshots")
            .createSignedUrl(vp.screenshot_paths[0], 3600);

          if (signedData?.signedUrl) {
            const imgResp = await fetch(signedData.signedUrl);
            const imgBuf = await imgResp.arrayBuffer();
            const imgB64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
            userContent.unshift({
              type: "image",
              source: { type: "base64", media_type: imgResp.headers.get("content-type") || "image/jpeg", data: imgB64 },
            } as Record<string, unknown> as { type: "text"; text: string });
          }
        }

        const { text: aText, usage: aUsage } = await callClaude({
          system: VIRAL_AUTOPSY,
          messages: [{ role: "user", content: userContent }],
          maxTokens: 4096,
        });

        const cost = estimateCost("claude-opus-4", aUsage.input_tokens, aUsage.output_tokens);
        totalCostUsd += cost;
        llmCallCount++;
        await logLlm("autopsy", "claude-opus-4", aUsage.input_tokens, aUsage.output_tokens, cost);

        const aJson = JSON.parse((aText.match(/\{[\s\S]*\}/) || ["{}"])[0]);
        await adminClient.from("viral_autopsies").upsert({
          post_id: vp.id,
          first_3sec_breakdown: aJson.first_3sec_breakdown || null,
          hook_anatomy: aJson.hook_anatomy || null,
          emotion_curve: aJson.emotion_curve || null,
          info_density: aJson.info_density || null,
          topicality_anchor: aJson.topicality_anchor || null,
          comment_reaction_pattern: aJson.comment_reaction_pattern || null,
          algorithm_signals: aJson.algorithm_signals || null,
          scarcity_exclusivity: aJson.scarcity_exclusivity || null,
          visual_impact_score: aJson.visual_impact_score?.score || null,
          replicability: aJson.replicability || null,
          why_viral_replicable: aJson.why_viral_replicable || [],
          why_viral_situational: aJson.why_viral_situational || [],
          application_warnings: aJson.application_warnings || [],
          total_cost_usd: cost,
        });
      } catch (e) {
        console.error(`Viral 부검 실패 post_id=${vp.id}:`, e);
      }
    }

    await broadcast("autopsy", "completed");

    // ============================================
    // STAGE 4: decompose
    // ============================================
    await broadcast("decompose", "running");

    const { data: allPosts } = await adminClient
      .from("benchmark_posts")
      .select("*, post_classifications(*)")
      .eq("account_id", account_id)
      .eq("within_scope", true);

    const decompositions: Record<string, unknown>[] = [];

    for (const post of (allPosts || [])) {
      if (!post.caption) continue;
      try {
        const { text: dText, usage: dUsage } = await callClaude({
          system: DECOMPOSE_STANDARD,
          messages: [{ role: "user", content: `캡션:\n${post.caption}\n\ntype=${post.media_type}, likes=${post.like_count}` }],
          maxTokens: 2048,
        });
        const cost = estimateCost("claude-opus-4", dUsage.input_tokens, dUsage.output_tokens);
        totalCostUsd += cost;
        llmCallCount++;
        await logLlm("decompose", "claude-opus-4", dUsage.input_tokens, dUsage.output_tokens, cost);

        const dJson = JSON.parse((dText.match(/\{[\s\S]*\}/) || ["{}"])[0]);
        decompositions.push({
          post_id: post.id,
          category: (post.post_classifications as Array<{ primary_category: string }>)?.[0]?.primary_category || "listing",
          ...dJson,
        });
      } catch { /* 스킵 */ }
    }

    await broadcast("decompose", "completed");

    // ============================================
    // STAGE 5: synthesize (Playbook)
    // ============================================
    await broadcast("synthesize", "running");

    // 카테고리별 그룹핑
    const byCategory: Record<string, typeof decompositions> = {};
    for (const d of decompositions) {
      const cat = (d.category as string) || "listing";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(d);
    }

    const playbookIds: string[] = [];

    for (const [category, group] of Object.entries(byCategory)) {
      if (group.length < 2) continue;
      try {
        const { text: pText, usage: pUsage } = await callClaude({
          system: SYNTHESIZE_PLAYBOOK,
          messages: [{ role: "user", content: JSON.stringify(group.slice(0, 10)) }],
          maxTokens: 2048,
        });
        const cost = estimateCost("claude-opus-4", pUsage.input_tokens, pUsage.output_tokens);
        totalCostUsd += cost;
        llmCallCount++;
        await logLlm("synthesize", "claude-opus-4", pUsage.input_tokens, pUsage.output_tokens, cost);

        const pb = JSON.parse((pText.match(/\{[\s\S]*\}/) || ["{}"])[0]);
        if (!pb.name) continue;

        // Viral 부검 ID 수집
        const viralIds = group
          .filter((d) => (viralPosts || []).some((vp) => vp.id === d.post_id))
          .map((d) => d.post_id as string);

        const { data: { user: authUser } } = await userClient.auth.getUser();

        const { data: newPb } = await adminClient.from("playbooks").insert({
          user_id: authUser!.id,
          source_account_id: account_id,
          code: `PB-${Date.now().toString(36).toUpperCase()}`,
          name: pb.name,
          category,
          evidence_post_ids: group.map((d) => d.post_id as string),
          viral_autopsy_ids: viralIds,
          derived_from_viral: viralIds.length > 0,
          visual: pb.visual || {},
          copy: pb.copy || {},
          format: pb.format || {},
          hashtags: pb.hashtags || {},
          timing: pb.timing || null,
          is_recommended: viralIds.length > 0,
        }).select("id").single();

        if (newPb) playbookIds.push(newPb.id);
      } catch (e) {
        console.error(`Playbook 합성 실패 category=${category}:`, e);
      }
    }

    await broadcast("synthesize", "completed");

    // ============================================
    // STAGE 6: voice (톤 프로파일)
    // ============================================
    await broadcast("voice", "running");

    const allCaptions = (allPosts || [])
      .map((p) => p.caption)
      .filter(Boolean)
      .join("\n\n---\n\n");

    try {
      const { text: vText, usage: vUsage } = await callClaude({
        system: EXTRACT_VOICE,
        messages: [{ role: "user", content: `다음은 벤치마크 계정의 모든 캡션입니다:\n\n${allCaptions.slice(0, 8000)}` }],
        maxTokens: 2048,
      });
      const cost = estimateCost("claude-opus-4", vUsage.input_tokens, vUsage.output_tokens);
      totalCostUsd += cost;
      llmCallCount++;
      await logLlm("voice", "claude-opus-4", vUsage.input_tokens, vUsage.output_tokens, cost);

      const vJson = JSON.parse((vText.match(/\{[\s\S]*\}/) || ["{}"])[0]);
      await adminClient.from("voice_profiles").upsert({
        source_account_id: account_id,
        ending_ratio: vJson.ending_ratio || {},
        vocabulary_high_freq: vJson.vocabulary_high_freq || [],
        vocabulary_banned: vJson.vocabulary_banned_inferred || [],
        signature_phrases_blacklist: vJson.signature_phrases_blacklist || [],
        emoji_usage: vJson.emoji_usage || {},
        honorific_distance: vJson.honorific_distance || "neutral_formal",
        structural_signatures: vJson.structural_signatures || [],
      });
    } catch (e) {
      console.error("톤 프로파일 추출 실패:", e);
    }

    await broadcast("voice", "completed");

    // ============================================
    // STAGE 7: report
    // ============================================
    await broadcast("report", "running");

    // 포트폴리오 비율
    const { data: classData } = await adminClient
      .from("post_classifications")
      .select("primary_category")
      .in("post_id", (allPosts || []).map((p) => p.id));

    const breakdown: Record<string, number> = {};
    for (const c of (classData || [])) {
      breakdown[c.primary_category] = (breakdown[c.primary_category] || 0) + 1;
    }

    // Viral 하이라이트
    const { data: autopsies } = await adminClient
      .from("viral_autopsies")
      .select("*, benchmark_posts!inner(id, media_type, like_count)")
      .in("post_id", (viralPosts || []).map((p) => p.id));

    const viralHighlights = (autopsies || []).map((a) => ({
      post_id: a.post_id,
      why_viral_replicable: a.why_viral_replicable,
      application_warnings: a.application_warnings,
    }));

    await adminClient.from("analyses").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      portfolio_breakdown: breakdown,
      viral_highlights: viralHighlights,
      playbook_ids: playbookIds,
      total_cost_usd: totalCostUsd,
      llm_call_count: llmCallCount,
    }).eq("id", analysisId);

    await adminClient.from("benchmark_accounts")
      .update({ last_analyzed_at: new Date().toISOString() })
      .eq("id", account_id);

    await broadcast("report", "completed");

    return new Response(
      JSON.stringify({ analysis_id: analysisId, total_cost_usd: totalCostUsd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("analyze-account 오류:", err);
    await adminClient.from("analyses").update({
      status: "failed",
      error_log: (err as Error).message,
    }).eq("id", analysisId);

    await adminClient.channel(`analysis:${analysisId}`).send({
      type: "broadcast",
      event: "error",
      payload: { message: (err as Error).message },
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// 헬퍼: post_performance upsert
async function upsertPerformance(
  adminClient: ReturnType<typeof createAdminClient>,
  postId: string,
  engRate: number,
  avgEng: number,
  signals: string[],
  tier: string,
  followerCount: number
) {
  await adminClient.from("post_performance").upsert({
    post_id: postId,
    engagement_rate: engRate,
    engagement_multiple: avgEng > 0 ? engRate / avgEng : null,
    is_top_performer: tier !== "standard",
    save_signals: 0,
    share_signals: 0,
    comment_depth_score: 0,
  });

  await adminClient.from("benchmark_posts")
    .update({ tier, tier_signals: signals })
    .eq("id", postId);
}

function p_comment(post: Record<string, unknown>): number {
  return (post.comment_count as number) || 0;
}
