import { createAdminClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN")!;
const APIFY_BASE = "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items";

async function apifyRun(input: Record<string, unknown>, timeout = 90): Promise<unknown[]> {
  const url = `${APIFY_BASE}?token=${APIFY_TOKEN}&timeout=${timeout}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Apify 오류 ${resp.status}: ${err.slice(0, 200)}`);
  }
  return await resp.json() as unknown[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminClient = createAdminClient();
    const body = await req.json() as {
      username: string;       // @없이 또는 @포함 모두 허용
      user_id: string;
      weeks?: number;         // 기본 3주
    };

    const handle = body.username.replace(/^@/, "").trim();
    const userId = body.user_id;
    const weeks = body.weeks ?? 3;
    const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);
    const igUrl = `https://www.instagram.com/${handle}/`;

    console.log(`scrape-instagram: @${handle}, ${weeks}주 이내`);

    // ── 프로필 + 게시물 병렬 수집 ──────────────────
    const [profileArr, postsArr] = await Promise.all([
      apifyRun({ directUrls: [igUrl], resultsType: "details", resultsLimit: 1 }, 60),
      apifyRun({ directUrls: [igUrl], resultsType: "posts", resultsLimit: 50 }, 90),
    ]);

    // ── 프로필 파싱 ────────────────────────────────
    const profile = (profileArr[0] ?? {}) as Record<string, unknown>;
    const followerCount = (profile.followersCount as number) ?? null;
    const followingCount = (profile.followingCount as number) ?? null;
    const postCount = (profile.postsCount as number) ?? null;
    const bio = (profile.biography as string) ?? null;
    const displayName = (profile.fullName as string) ?? null;

    // ── benchmark_accounts 생성 ────────────────────
    const { data: account, error: acctErr } = await adminClient
      .from("benchmark_accounts")
      .insert({
        user_id: userId,
        handle: `@${handle}`,
        display_name: displayName,
        bio,
        follower_count: followerCount,
        following_count: followingCount,
        post_count: postCount,
        category: "real_estate",
        tracking_cadence: "weekly",
      })
      .select("id")
      .single();

    if (acctErr || !account) {
      throw new Error(`계정 저장 실패: ${acctErr?.message}`);
    }

    const accountId = account.id;

    // ── 게시물 파싱 & 필터링 (weeks 이내) ──────────
    type RawPost = Record<string, unknown>;
    const rawPosts = postsArr as RawPost[];

    const filtered = rawPosts.filter((p) => {
      const ts = p.timestamp as string | undefined;
      if (!ts) return true; // 날짜 없으면 포함
      return new Date(ts) >= cutoff;
    });

    console.log(`전체 ${rawPosts.length}개 → ${weeks}주 이내 ${filtered.length}개`);

    const inserts = filtered.map((p) => {
      // media_type 변환
      const pType = (p.type as string || "").toLowerCase();
      let mediaType = "photo";
      if (pType === "video" || (p.productType as string) === "clips") mediaType = "reel";
      else if (pType === "sidecar") mediaType = "carousel";

      // 슬라이드 수
      const childPosts = Array.isArray(p.childPosts) ? p.childPosts : [];
      const slideCount = pType === "sidecar" ? Math.max(childPosts.length, 1) : 1;

      // 해시태그
      const hashtags = Array.isArray(p.hashtags) ? (p.hashtags as string[]) : [];

      // 댓글
      const rawComments = Array.isArray(p.latestComments) ? p.latestComments as RawPost[] : [];
      const topComments = rawComments.slice(0, 10).map((c) => ({
        author: (c.ownerUsername as string) || "",
        text: (c.text as string) || "",
      }));

      // 조회수
      const viewCount = (p.videoViewCount as number) ?? (p.videoPlayCount as number) ?? null;

      return {
        account_id: accountId,
        media_type: mediaType,
        slide_count: slideCount,
        caption: (p.caption as string) || null,
        hashtags,
        like_count: (p.likesCount as number) ?? null,
        comment_count: (p.commentsCount as number) ?? null,
        view_count: viewCount,
        top_comments: topComments,
        within_scope: true,
        screenshot_paths: [],
        ocr_raw_json: {
          apify_id: p.id,
          shortCode: p.shortCode,
          url: p.url,
          timestamp: p.timestamp,
        },
      };
    });

    if (inserts.length > 0) {
      const { error: postsErr } = await adminClient.from("benchmark_posts").insert(inserts);
      if (postsErr) console.error("게시물 저장 오류:", postsErr);
    }

    return new Response(
      JSON.stringify({
        account_id: accountId,
        profile: {
          handle: `@${handle}`,
          display_name: displayName,
          bio,
          follower_count: followerCount,
          following_count: followingCount,
          post_count: postCount,
        },
        posts_scraped: inserts.length,
        posts_total: rawPosts.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("scrape-instagram 오류:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
