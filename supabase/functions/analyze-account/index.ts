import { createAdminClient } from "../_shared/supabase.ts";
import { callClaude, estimateCost } from "../_shared/anthropic.ts";
import {
  CLASSIFY_POSTS,
  DECOMPOSE_STANDARD,
  SYNTHESIZE_PLAYBOOK,
  EXTRACT_VOICE,
  VIRAL_AUTOPSY,
  COMMENT_CLASSIFY,
} from "../_shared/prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PostInput {
  temp_id?: string;
  media_type: string;
  slide_count: number;
  caption: string;
  hashtags: string[];
  like_count: number | null;
  comment_count: number | null;
  view_count: number | null;
  posted_relative: string;
  top_comments: Array<{ author: string; text: string }>;
  is_viral_manual: boolean;
  is_from_highlight: boolean;
  within_scope: boolean;
  screenshot_paths: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminClient = createAdminClient();

  const body = await req.json() as {
    account_id: string;
    analysis_type?: string;
    channel_name?: string;
    posts?: PostInput[];
  };

  const { account_id, analysis_type = "initial", channel_name, posts: postsInput } = body;

  // 계정 정보 로드
  const { data: accountRecord, error: acctErr } = await adminClient
    .from("benchmark_accounts")
    .select("user_id, follower_count")
    .eq("id", account_id)
    .single();

  if (acctErr || !accountRecord) {
    return new Response(JSON.stringify({ error: "계정을 찾을 수 없습니다" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
    return new Response(JSON.stringify({ error: "분석 레코드 생성 실패" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const analysisId = analysis.id;

  // Realtime 브로드캐스트 헬퍼 (channel_name 우선 사용)
  const broadcastChannel = channel_name || `analysis:${analysisId}`;
  const broadcast = async (stage: string, status: string) => {
    try {
      await adminClient.channel(broadcastChannel).send({
        type: "broadcast",
        event: "progress",
        payload: { stage, status },
      });
    } catch { /* 브로드캐스트 실패는 무시 */ }
  };

  const logLlm = async (stage: string, model: string, inputTokens: number, outputTokens: number, costUsd: number) => {
    await adminClient.from("llm_calls").insert({
      analysis_id: analysisId,
      stage, model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      cached: false,
    }).catch(() => {});
  };

  let totalCostUsd = 0;
  let llmCallCount = 0;

  try {
    // ── 게시물 저장 (클라이언트에서 전달된 경우 admin client로 직접 저장) ──
    if (postsInput && postsInput.length > 0) {
      const inserts = postsInput.map((p) => ({
        account_id,
        media_type: p.media_type || "photo",
        slide_count: p.slide_count || 1,
        caption: p.caption || null,
        hashtags: p.hashtags || [],
        like_count: p.like_count ?? null,
        comment_count: p.comment_count ?? null,
        view_count: p.view_count ?? null,
        top_comments: p.top_comments || [],
        tier_manual_override: p.is_viral_manual ? "viral" : null,
        is_from_highlight: p.is_from_highlight || false,
        within_scope: p.within_scope !== false,
        screenshot_paths: p.screenshot_paths || [],
      }));
      await adminClient.from("benchmark_posts").insert(inserts);
    }

    // 분석 대상 게시물 로드 (최대 20개)
    const { data: posts } = await adminClient
      .from("benchmark_posts")
      .select("*")
      .eq("account_id", account_id)
      .eq("within_scope", true)
      .limit(20);

    if (!posts || posts.length === 0) {
      throw new Error("분석할 게시물이 없습니다. Step 3에서 게시물을 입력해주세요.");
    }

    // ════════════════════════════════════════
    // STAGE 1: classify (Haiku — 빠르고 저렴)
    // ════════════════════════════════════════
    await broadcast("classify", "running");

    const BATCH = 5;
    for (let i = 0; i < posts.length; i += BATCH) {
      const batch = posts.slice(i, i + BATCH);
      const batchText = batch.map((p, idx) =>
        `[${idx}] ${(p.caption || "").slice(0, 200)}`
      ).join("\n---\n");

      try {
        const { text, usage } = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: CLASSIFY_POSTS,
          messages: [{ role: "user", content: `${batch.length}개 게시물 분류. 배열 JSON:\n\n${batchText}` }],
          maxTokens: 512,
        });
        const cost = estimateCost("claude-haiku", usage.input_tokens, usage.output_tokens);
        totalCostUsd += cost; llmCallCount++;
        await logLlm("classify", "claude-haiku", usage.input_tokens, usage.output_tokens, cost);

        const jsonMatch = text.match(/\[[\s\S]*?\]/);
        const results: Array<{ primary_category?: string; secondary_category?: string; confidence?: number; tags?: string[] }> = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        for (let j = 0; j < batch.length; j++) {
          const r = results[j] || {};
          await adminClient.from("post_classifications").upsert({
            post_id: batch[j].id,
            primary_category: r.primary_category || "listing",
            secondary_category: r.secondary_category || null,
            confidence: r.confidence || 0.5,
            tags: r.tags || [],
          }).catch(() => {});
        }
      } catch (e) {
        console.error("classify 배치 실패:", e);
      }
    }
    await broadcast("classify", "completed");

    // ════════════════════════════════════════
    // STAGE 2: rank (참여율 기반 Tier 배정)
    // ════════════════════════════════════════
    await broadcast("rank", "running");

    const followerCount = accountRecord.follower_count || 1000;
    const avgEng = posts.reduce((sum, p) =>
      sum + ((p.like_count || 0) + (p.comment_count || 0)) / followerCount, 0
    ) / posts.length;

    for (const post of posts) {
      const engRate = ((post.like_count || 0) + (post.comment_count || 0)) / followerCount;
      const signals: string[] = [];

      if (post.tier_manual_override === "viral") {
        await upsertPerf(adminClient, post.id, engRate, avgEng, signals, "viral");
        continue;
      }

      if (post.is_from_highlight) signals.push("highlight_pick");
      if (engRate >= avgEng * 3) signals.push("engagement_3x");
      if (post.media_type === "reel" && (post.view_count || 0) >= followerCount * 5) signals.push("view_5x");

      // 댓글 분류 (Haiku, 댓글 있는 경우만)
      const comments = Array.isArray(post.top_comments) ? post.top_comments : [];
      if (comments.length >= 3) {
        try {
          const commentTexts = (comments as Array<{ text: string }>).map((c) => c.text);
          const { text: cText, usage: cUsage } = await callClaude({
            model: "claude-haiku-4-5-20251001",
            system: COMMENT_CLASSIFY,
            messages: [{ role: "user", content: JSON.stringify(commentTexts) }],
            maxTokens: 256,
          });
          const cost = estimateCost("claude-haiku", cUsage.input_tokens, cUsage.output_tokens);
          totalCostUsd += cost; llmCallCount++;
          await logLlm("rank", "claude-haiku", cUsage.input_tokens, cUsage.output_tokens, cost);
          const cJson = JSON.parse((cText.match(/\{[\s\S]*?\}/) || ["{}"])[0]) as { save_signals?: number; share_signals?: number };
          if ((cJson.save_signals || 0) >= 2) signals.push("save_3x");
          if ((cJson.share_signals || 0) >= 2) signals.push("share_3x");
        } catch { /* 스킵 */ }
      }

      const tier = signals.length >= 1 ? "viral"
        : engRate >= avgEng * 1.5 ? "high_performer"
        : "standard";
      await upsertPerf(adminClient, post.id, engRate, avgEng, signals, tier);
    }
    await broadcast("rank", "completed");

    // ════════════════════════════════════════
    // STAGE 3: autopsy (Viral 부검 — Opus 유지)
    // ════════════════════════════════════════
    await broadcast("autopsy", "running");

    const { data: viralPosts } = await adminClient
      .from("benchmark_posts")
      .select("*")
      .eq("account_id", account_id)
      .eq("within_scope", true)
      .in("tier", ["viral"]);

    for (const vp of (viralPosts || []).slice(0, 5)) { // 최대 5건
      try {
        const captionText = vp.caption || "(캡션 없음)";
        const commentsList = Array.isArray(vp.top_comments) ? vp.top_comments as Array<{ author: string; text: string }> : [];
        const commentsText = commentsList.slice(0, 20).map((c, i) => `[${i}] @${c.author}: ${c.text}`).join("\n");

        // 비전 content 타입 올바르게 선언
        const userContent: Array<{ type: string; [key: string]: unknown }> = [
          {
            type: "text",
            text: `캡션:\n${captionText}\n\n댓글:\n${commentsText}\n\n메타데이터: likes=${vp.like_count}, comments=${vp.comment_count}, views=${vp.view_count}, media_type=${vp.media_type}`,
          },
        ];

        // 스크린샷 있으면 이미지 앞에 추가
        if (vp.screenshot_paths?.length > 0) {
          try {
            const { data: signedData } = await adminClient.storage
              .from("screenshots")
              .createSignedUrl(vp.screenshot_paths[0], 3600);
            if (signedData?.signedUrl) {
              const imgResp = await fetch(signedData.signedUrl);
              const imgBuf = await imgResp.arrayBuffer();
              const imgB64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
              userContent.unshift({
                type: "image",
                source: {
                  type: "base64",
                  media_type: imgResp.headers.get("content-type") || "image/jpeg",
                  data: imgB64,
                },
              });
            }
          } catch { /* 이미지 없으면 텍스트만 */ }
        }

        const { text: aText, usage: aUsage } = await callClaude({
          system: VIRAL_AUTOPSY,
          messages: [{ role: "user", content: userContent }],
          maxTokens: 3000,
        });
        const cost = estimateCost("claude-opus-4-6", aUsage.input_tokens, aUsage.output_tokens);
        totalCostUsd += cost; llmCallCount++;
        await logLlm("autopsy", "claude-opus-4-6", aUsage.input_tokens, aUsage.output_tokens, cost);

        const aJson = JSON.parse((aText.match(/\{[\s\S]*\}/) || ["{}"])[0]) as Record<string, unknown>;
        await adminClient.from("viral_autopsies").upsert({
          post_id: vp.id,
          first_3sec_breakdown: aJson.first_3sec_breakdown ?? null,
          hook_anatomy: aJson.hook_anatomy ?? null,
          emotion_curve: aJson.emotion_curve ?? null,
          info_density: aJson.info_density ?? null,
          topicality_anchor: aJson.topicality_anchor ?? null,
          comment_reaction_pattern: aJson.comment_reaction_pattern ?? null,
          algorithm_signals: aJson.algorithm_signals ?? null,
          scarcity_exclusivity: aJson.scarcity_exclusivity ?? null,
          visual_impact_score: (aJson.visual_impact_score as Record<string, number>)?.score ?? null,
          replicability: aJson.replicability ?? null,
          why_viral_replicable: (aJson.why_viral_replicable as string[]) ?? [],
          why_viral_situational: (aJson.why_viral_situational as string[]) ?? [],
          application_warnings: (aJson.application_warnings as string[]) ?? [],
          total_cost_usd: cost,
        }).catch((e) => console.error("viral_autopsies upsert 실패:", e));
      } catch (e) {
        console.error(`Viral 부검 실패 post_id=${vp.id}:`, e);
      }
    }
    await broadcast("autopsy", "completed");

    // ════════════════════════════════════════
    // STAGE 4: decompose (Haiku — 캡션 있는 것만)
    // ════════════════════════════════════════
    await broadcast("decompose", "running");

    const { data: allPosts } = await adminClient
      .from("benchmark_posts")
      .select("*, post_classifications(*)")
      .eq("account_id", account_id)
      .eq("within_scope", true);

    const decompositions: Array<Record<string, unknown>> = [];

    for (const post of (allPosts || []).filter((p) => p.caption && p.caption.length > 10)) {
      try {
        const { text: dText, usage: dUsage } = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: DECOMPOSE_STANDARD,
          messages: [{ role: "user", content: `캡션:\n${(post.caption || "").slice(0, 400)}\n\ntype=${post.media_type}, likes=${post.like_count}` }],
          maxTokens: 1500,
        });
        const cost = estimateCost("claude-haiku", dUsage.input_tokens, dUsage.output_tokens);
        totalCostUsd += cost; llmCallCount++;
        await logLlm("decompose", "claude-haiku", dUsage.input_tokens, dUsage.output_tokens, cost);

        const dJson = JSON.parse((dText.match(/\{[\s\S]*\}/) || ["{}"])[0]) as Record<string, unknown>;
        const cats = post.post_classifications as Array<{ primary_category: string }> | null;
        decompositions.push({
          post_id: post.id,
          category: cats?.[0]?.primary_category || "listing",
          ...dJson,
        });
      } catch { /* 스킵 */ }
    }
    await broadcast("decompose", "completed");

    // ════════════════════════════════════════
    // STAGE 5: synthesize Playbook (Sonnet)
    // ════════════════════════════════════════
    await broadcast("synthesize", "running");

    const byCategory: Record<string, Array<Record<string, unknown>>> = {};
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
          model: "claude-sonnet-4-6",
          system: SYNTHESIZE_PLAYBOOK,
          messages: [{ role: "user", content: JSON.stringify(group.slice(0, 8)) }],
          maxTokens: 2000,
        });
        const cost = estimateCost("claude-sonnet-4-6", pUsage.input_tokens, pUsage.output_tokens);
        totalCostUsd += cost; llmCallCount++;
        await logLlm("synthesize", "claude-sonnet-4-6", pUsage.input_tokens, pUsage.output_tokens, cost);

        const pb = JSON.parse((pText.match(/\{[\s\S]*\}/) || ["{}"])[0]) as Record<string, unknown>;
        if (!pb.name) continue;

        const viralIds = group
          .filter((d) => (viralPosts || []).some((vp) => vp.id === d.post_id))
          .map((d) => d.post_id as string);

        const { data: newPb } = await adminClient.from("playbooks").insert({
          user_id: accountRecord.user_id,
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

    // ════════════════════════════════════════
    // STAGE 6: voice 톤 프로파일 (Sonnet)
    // ════════════════════════════════════════
    await broadcast("voice", "running");

    const allCaptions = (allPosts || [])
      .map((p) => p.caption)
      .filter(Boolean)
      .join("\n\n---\n\n");

    if (allCaptions.length > 50) {
      try {
        const { text: vText, usage: vUsage } = await callClaude({
          model: "claude-sonnet-4-6",
          system: EXTRACT_VOICE,
          messages: [{ role: "user", content: `다음 캡션들:\n\n${allCaptions.slice(0, 6000)}` }],
          maxTokens: 1500,
        });
        const cost = estimateCost("claude-sonnet-4-6", vUsage.input_tokens, vUsage.output_tokens);
        totalCostUsd += cost; llmCallCount++;
        await logLlm("voice", "claude-sonnet-4-6", vUsage.input_tokens, vUsage.output_tokens, cost);

        const vJson = JSON.parse((vText.match(/\{[\s\S]*\}/) || ["{}"])[0]) as Record<string, unknown>;
        await adminClient.from("voice_profiles").upsert({
          source_account_id: account_id,
          ending_ratio: vJson.ending_ratio || {},
          vocabulary_high_freq: (vJson.vocabulary_high_freq as string[]) || [],
          vocabulary_banned: (vJson.vocabulary_banned_inferred as string[]) || [],
          signature_phrases_blacklist: (vJson.signature_phrases_blacklist as string[]) || [],
          emoji_usage: vJson.emoji_usage || {},
          honorific_distance: (vJson.honorific_distance as string) || "neutral_formal",
          structural_signatures: (vJson.structural_signatures as string[]) || [],
        }).catch((e) => console.error("voice_profiles upsert 실패:", e));
      } catch (e) {
        console.error("톤 프로파일 실패:", e);
      }
    }
    await broadcast("voice", "completed");

    // ════════════════════════════════════════
    // STAGE 7: report 집계
    // ════════════════════════════════════════
    await broadcast("report", "running");

    const { data: classData } = await adminClient
      .from("post_classifications")
      .select("primary_category")
      .in("post_id", (allPosts || []).map((p) => p.id));

    const breakdown: Record<string, number> = {};
    for (const c of (classData || [])) {
      breakdown[c.primary_category] = (breakdown[c.primary_category] || 0) + 1;
    }

    const { data: autopsies } = await adminClient
      .from("viral_autopsies")
      .select("post_id, why_viral_replicable, application_warnings")
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
      JSON.stringify({ analysis_id: analysisId, total_cost_usd: totalCostUsd, llm_calls: llmCallCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("analyze-account 오류:", err);
    const errMsg = err instanceof Error ? err.message : "알 수 없는 오류";

    await adminClient.from("analyses").update({
      status: "failed",
      error_log: errMsg,
    }).eq("id", analysisId).catch(() => {});

    try {
      await adminClient.channel(broadcastChannel).send({
        type: "broadcast",
        event: "error",
        payload: { message: errMsg },
      });
    } catch { /* 무시 */ }

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── 헬퍼 ──────────────────────────────────
async function upsertPerf(
  adminClient: ReturnType<typeof createAdminClient>,
  postId: string,
  engRate: number,
  avgEng: number,
  signals: string[],
  tier: string
) {
  await adminClient.from("post_performance").upsert({
    post_id: postId,
    engagement_rate: engRate,
    engagement_multiple: avgEng > 0 ? engRate / avgEng : null,
    is_top_performer: tier !== "standard",
    save_signals: signals.filter((s) => s.includes("save")).length,
    share_signals: signals.filter((s) => s.includes("share")).length,
    comment_depth_score: 0,
  }).catch(() => {});

  await adminClient.from("benchmark_posts")
    .update({ tier, tier_signals: signals })
    .eq("id", postId)
    .catch(() => {});
}
