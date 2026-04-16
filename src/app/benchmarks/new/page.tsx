"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { WizardSteps } from "@/components/benchmarks/WizardSteps";
import { Step1AccountInfo } from "@/components/benchmarks/Step1AccountInfo";
import {
  Step2Upload,
  type UploadedScreenshot,
} from "@/components/benchmarks/Step2Upload";
import {
  Step3Review,
  type ExtractedPost,
} from "@/components/benchmarks/Step3Review";
import { Step4Settings } from "@/components/benchmarks/Step4Settings";
import {
  Step5Analysis,
  defaultStages,
} from "@/components/benchmarks/Step5Analysis";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

const WIZARD_STEPS = [
  "계정 정보",
  "스크린샷 업로드",
  "확인·수정",
  "분석 설정",
  "분석 실행",
];

export default function NewBenchmarkPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1
  const [accountData, setAccountData] = useState({
    handle: "",
    display_name: "",
    bio: "",
    follower_count: null as number | null,
    following_count: null as number | null,
    post_count: null as number | null,
    is_niche_account: false,
    category: "",
  });

  // Step 2
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);

  // Step 3
  const [extractedPosts, setExtractedPosts] = useState<ExtractedPost[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Step 4
  const [trackingCadence, setTrackingCadence] = useState("weekly");

  // Step 5
  const [stages, setStages] = useState(defaultStages);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "running" | "completed" | "failed"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1 → 2: 계정 저장
  const handleStep1Next = async () => {
    const supabase = createClient();
    const user = { id: getCurrentUserId() };

    if (!accountId) {
      type AccountInsert = Database["public"]["Tables"]["benchmark_accounts"]["Insert"];
      const insertPayload: AccountInsert = {
        user_id: user.id,
        handle: accountData.handle,
        display_name: accountData.display_name || null,
        bio: accountData.bio || null,
        follower_count: accountData.follower_count,
        following_count: accountData.following_count,
        post_count: accountData.post_count,
        category: accountData.category || null,
        is_niche_account: accountData.is_niche_account,
        tracking_cadence: trackingCadence,
      };
      const { data, error } = await supabase
        .from("benchmark_accounts")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        console.error("계정 저장 실패:", error);
        return;
      }
      setAccountId(data.id);
    }

    setCurrentStep(2);
  };

  // Step 3: OCR 실행
  const handleRunOcr = useCallback(async () => {
    if (!accountId) return;
    setOcrLoading(true);

    try {
      const supabase = createClient();
      const uploadedShots = screenshots
        .filter((s) => s.status === "uploaded" && s.storagePath)
        .map((s) => ({
          storage_path: s.storagePath!,
          screenshot_type: s.screenshotType,
        }));

      const { data, error } = await supabase.functions.invoke(
        "ocr-extract-posts",
        {
          body: {
            account_id: accountId,
            screenshots: uploadedShots,
          },
        }
      );

      if (error) throw error;


      const posts: ExtractedPost[] = (data.extracted_posts || []).map(
        (p: Record<string, unknown>, idx: number) => {
          // 3개월 범위 필터링 (상대 시각 기반 추정)
          let withinScope = true;
          const relative = p.posted_relative as string;
          if (relative) {
            const weekMatch = relative.match(/(\d+)\s*(주|week)/);
            const monthMatch = relative.match(/(\d+)\s*(개월|month)/);
            const yearMatch = relative.match(/(\d+)\s*(년|year)/);
            if (weekMatch && Number(weekMatch[1]) > 12) withinScope = false;
            if (monthMatch && Number(monthMatch[1]) > 3) withinScope = false;
            if (yearMatch) withinScope = false;
          }

          return {
            temp_id: `ocr-${idx}-${Date.now()}`,
            media_type: (p.media_type as string) || "photo",
            slide_count: (p.slide_count as number) || 1,
            caption: (p.caption as string) || "",
            hashtags: (p.hashtags as string[]) || [],
            like_count: p.like_count as number | null,
            comment_count: p.comment_count as number | null,
            view_count: p.view_count as number | null,
            posted_relative: (p.posted_relative as string) || "",
            posted_at: null,
            top_comments: (p.top_comments as Array<{ author: string; text: string }>) || [],
            confidence: (p.confidence as number) || 0.5,
            needs_review_fields: (p.uncertain_fields as string[]) || (p.needs_review_fields as string[]) || [],
            is_viral_manual: false,
            is_from_highlight: false,
            within_scope: withinScope,
            screenshot_paths: [],
          };
        }
      );

      setExtractedPosts(posts);
    } catch (err) {
      console.error("OCR 실패:", err);
    } finally {
      setOcrLoading(false);
    }
  }, [accountId, screenshots]);

  // Step 4 → 5: 분석 시작
  const handleStartAnalysis = async () => {
    if (!accountId) return;
    setCurrentStep(5);
    setAnalysisStatus("running");
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // 먼저 게시물들을 DB에 저장
      type PostInsert = Database["public"]["Tables"]["benchmark_posts"]["Insert"];
      const inScopePosts = extractedPosts.filter((p) => p.within_scope);
      for (const post of inScopePosts) {
        const postPayload: PostInsert = {
          account_id: accountId,
          media_type: post.media_type,
          slide_count: post.slide_count,
          caption: post.caption,
          hashtags: post.hashtags,
          like_count: post.like_count,
          comment_count: post.comment_count,
          view_count: post.view_count,
          top_comments: post.top_comments,
          tier_manual_override: post.is_viral_manual ? "viral" : null,
          is_from_highlight: post.is_from_highlight,
          within_scope: post.within_scope,
          screenshot_paths: post.screenshot_paths,
        };
        await supabase.from("benchmark_posts").insert(postPayload);
      }

      // 분석 시작 (Edge Function 호출)
      const { data, error } = await supabase.functions.invoke(
        "analyze-account",
        {
          body: {
            account_id: accountId,
            analysis_type: "initial",
          },
        }
      );

      if (error) throw error;

      // 분석이 비동기로 진행되므로 Realtime 채널로 진행 상태 수신
      if (data?.analysis_id) {
        const channel = supabase.channel(`analysis:${data.analysis_id}`);
        channel
          .on("broadcast", { event: "progress" }, ({ payload }) => {
            const { stage, status } = payload as {
              stage: string;
              status: string;
            };
            setStages((prev) =>
              prev.map((s) =>
                s.key === stage
                  ? { ...s, status: status as "running" | "completed" | "failed" }
                  : s
              )
            );

            if (status === "completed" && stage === "report") {
              setAnalysisStatus("completed");
              channel.unsubscribe();
            }
          })
          .on("broadcast", { event: "error" }, ({ payload }) => {
            setAnalysisStatus("failed");
            setErrorMessage(
              (payload as { message: string }).message ||
                "분석 중 오류가 발생했습니다"
            );
            channel.unsubscribe();
          })
          .subscribe();

        // 첫 단계를 running으로 표시
        setStages((prev) =>
          prev.map((s, i) =>
            i === 0 ? { ...s, status: "running" } : s
          )
        );
      }
    } catch (err) {
      setAnalysisStatus("failed");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "분석 시작에 실패했습니다. Edge Function이 배포되었는지 확인해주세요."
      );
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl font-bold text-charcoal mb-6">
            새 벤치마크 추가
          </h1>

          <WizardSteps currentStep={currentStep} steps={WIZARD_STEPS} />

          {currentStep === 1 && (
            <Step1AccountInfo
              data={accountData}
              onChange={setAccountData}
              onNext={handleStep1Next}
            />
          )}

          {currentStep === 2 && (
            <Step2Upload
              screenshots={screenshots}
              onScreenshotsChange={setScreenshots}
              accountId={accountId}
              onNext={() => setCurrentStep(3)}
              onBack={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3Review
              posts={extractedPosts}
              onPostsChange={setExtractedPosts}
              ocrLoading={ocrLoading}
              onRunOcr={handleRunOcr}
              onNext={() => setCurrentStep(4)}
              onBack={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <Step4Settings
              posts={extractedPosts}
              trackingCadence={trackingCadence}
              onCadenceChange={setTrackingCadence}
              onNext={handleStartAnalysis}
              onBack={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && (
            <Step5Analysis
              stages={stages}
              analysisStatus={analysisStatus}
              errorMessage={errorMessage}
              onViewReport={() =>
                router.push(`/benchmarks/${accountId}`)
              }
            />
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
