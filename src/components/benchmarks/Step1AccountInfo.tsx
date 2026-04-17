"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";

interface AccountData {
  handle: string;
  display_name: string;
  bio: string;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  is_niche_account: boolean;
  category: string;
}

interface Step1Props {
  data: AccountData;
  onChange: (data: AccountData) => void;
  onNext: () => void;
  onBack?: () => void;
  // 자동 수집 완료 시 accountId와 함께 Step 4로 바로 이동
  onAutoScrape?: (accountId: string, postsCount: number) => void;
}

const CATEGORIES = [
  { value: "프리미엄", label: "프리미엄", desc: "강남·고가 아파트 (10억+)", icon: "💎" },
  { value: "일반", label: "일반", desc: "중간 가격대 아파트 (3~10억)", icon: "🏠" },
  { value: "실속형", label: "실속형", desc: "빌라·다세대·소형 (3억 이하)", icon: "🏘" },
  { value: "전문특화", label: "전문특화", desc: "특정 지역·타입만 다루는 계정", icon: "🎯" },
];

export function Step1AccountInfo({ data, onChange, onNext, onBack, onAutoScrape }: Step1Props) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "success" | "fail">("idle");
  const [handleError, setHandleError] = useState(false);

  // 자동 수집
  const [autoHandle, setAutoHandle] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [scrapeMsg, setScrapeMsg] = useState("");

  const update = (field: keyof AccountData, value: string | number | boolean | null) => {
    onChange({ ...data, [field]: value });
  };

  const toggleCategory = (value: string) => {
    const current = data.category ? data.category.split(",").filter(Boolean) : [];
    const updated = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    onChange({ ...data, category: updated.join(",") });
  };

  const selectedCategories = data.category ? data.category.split(",").filter(Boolean) : [];

  // ── 아이디로 자동 수집 ────────────────────────────
  const handleAutoScrape = async () => {
    const handle = autoHandle.replace(/^@/, "").trim();
    if (!handle) return;

    setScraping(true);
    setScrapeStatus("loading");
    setScrapeMsg("인스타그램에서 데이터 수집 중... (30~60초 소요)");

    try {
      const supabase = createClient();
      const userId = getCurrentUserId();

      const { data: fnData, error } = await supabase.functions.invoke("scrape-instagram", {
        body: { username: handle, user_id: userId, weeks: 3 },
      });

      if (error || fnData?.error) {
        throw new Error(fnData?.error || error?.message || "수집 실패");
      }

      const { account_id, profile, posts_scraped } = fnData as {
        account_id: string;
        profile: {
          handle: string;
          display_name: string | null;
          bio: string | null;
          follower_count: number | null;
          following_count: number | null;
          post_count: number | null;
        };
        posts_scraped: number;
      };

      // 폼 자동 채우기
      onChange({
        ...data,
        handle: profile.handle || `@${handle}`,
        display_name: profile.display_name || "",
        bio: profile.bio || "",
        follower_count: profile.follower_count,
        following_count: profile.following_count,
        post_count: profile.post_count,
      });

      setScrapeStatus("success");
      setScrapeMsg(`✓ 완료! 최근 3주 게시물 ${posts_scraped}개 수집`);

      // 부모에게 알려서 Step 4로 이동
      if (onAutoScrape) {
        setTimeout(() => onAutoScrape(account_id, posts_scraped), 800);
      }
    } catch (err) {
      console.error("자동 수집 실패:", err);
      setScrapeStatus("error");
      setScrapeMsg(`⚠️ ${(err as Error).message}`);
    } finally {
      setScraping(false);
    }
  };

  // ── 프로필 OCR (기존 방식 유지) ──────────────────
  const handleProfileScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setOcrStatus("idle");

    try {
      const supabase = createClient();
      const userId = getCurrentUserId();
      const path = `${userId}/profile-temp/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("screenshots").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: fnData, error } = await supabase.functions.invoke("ocr-extract-posts", {
        body: { account_id: null, screenshots: [{ storage_path: path, screenshot_type: "profile" }] },
      });

      if (!error && fnData?.profile) {
        const p = fnData.profile;
        onChange({
          ...data,
          handle: p.handle || data.handle,
          display_name: p.display_name || data.display_name,
          bio: p.bio || data.bio,
          follower_count: p.follower_count ?? data.follower_count,
          following_count: p.following_count ?? data.following_count,
          post_count: p.post_count ?? data.post_count,
        });
        setOcrStatus("success");
      } else {
        setOcrStatus("fail");
      }
    } catch {
      setOcrStatus("fail");
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (!data.handle.trim()) { setHandleError(true); return; }
    setHandleError(false);
    onNext();
  };

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">Step 1. 계정 정보</h2>

      {/* ── 자동 수집 (NEW) ── */}
      <div className="mb-6 p-4 rounded-2xl bg-sage/5 border border-sage/20">
        <p className="text-sm font-semibold text-sage-dark mb-1">아이디 입력 → 자동 수집 (추천)</p>
        <p className="text-xs text-charcoal-light/60 mb-3">
          캡처 없이 아이디만 입력하면 최근 3주 게시물을 자동으로 가져옵니다
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={autoHandle}
            onChange={(e) => setAutoHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAutoScrape()}
            placeholder="grace_zip_"
            disabled={scraping}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/40 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage text-sm disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAutoScrape}
            disabled={scraping || !autoHandle.trim()}
            className="px-4 py-2.5 rounded-xl bg-sage text-white text-sm font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {scraping ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                수집 중
              </span>
            ) : "자동 수집"}
          </button>
        </div>
        {scrapeStatus !== "idle" && (
          <p className={`text-xs mt-2 ${scrapeStatus === "error" ? "text-red-500" : scrapeStatus === "success" ? "text-sage-dark font-medium" : "text-charcoal-light/60"}`}>
            {scrapeMsg}
          </p>
        )}
      </div>

      {/* ── 구분선 ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-border-soft" />
        <span className="text-xs text-charcoal-light/50">또는 캡처로 입력</span>
        <div className="flex-1 h-px bg-border-soft" />
      </div>

      {/* 프로필 스크린샷 업로드 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-charcoal mb-1">프로필 스크린샷</label>
        <p className="text-xs text-charcoal-light/60 mb-2">
          인스타그램 프로필 화면을 캡쳐해서 올리면 아이디·팔로워 수 등이 자동 입력됩니다
        </p>
        <label htmlFor="profile-screenshot" className="cursor-pointer block">
          {previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="프로필 스크린샷" className="w-full max-h-48 object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm font-medium">AI 분석 중...</span>
                </div>
              )}
              {!uploading && (
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">탭하여 교체</div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border-soft rounded-2xl p-6 text-center hover:border-sage/40 transition-colors">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-sage/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-charcoal">프로필 사진 업로드</p>
              <p className="text-xs text-charcoal-light/60 mt-0.5">아이디·팔로워·소개글 자동 입력</p>
            </div>
          )}
        </label>
        {ocrStatus === "fail" && <p className="text-xs text-amber-600 mt-2">⚠️ 자동 입력 실패 — 아래에 직접 입력해주세요</p>}
        {ocrStatus === "success" && <p className="text-xs text-sage-dark mt-2">✓ 자동 입력 완료</p>}
        <input type="file" accept="image/*" onChange={handleProfileScreenshot} className="hidden" id="profile-screenshot" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">인스타 아이디 *</label>
          <input
            type="text"
            value={data.handle}
            placeholder="@grace_zip_"
            onChange={(e) => { update("handle", e.target.value); setHandleError(false); }}
            className={`w-full px-4 py-3 rounded-2xl border bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 transition-colors ${handleError ? "border-red-400" : "border-border-soft focus:border-sage"}`}
          />
          {handleError && <p className="text-xs text-red-500 mt-1">인스타 아이디를 입력해주세요</p>}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">계정 이름</label>
          <input
            type="text"
            value={data.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            placeholder="은혜 부동산"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1">
            계정 소개글<span className="text-xs text-charcoal-light/60 font-normal ml-2">(선택)</span>
          </label>
          <textarea
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="인스타 프로필 소개글"
            rows={2}
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">팔로워 수</label>
          <input
            type="number"
            value={data.follower_count ?? ""}
            onChange={(e) => update("follower_count", e.target.value ? Number(e.target.value) : null)}
            placeholder="3200"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">게시물 수</label>
          <input
            type="number"
            value={data.post_count ?? ""}
            onChange={(e) => update("post_count", e.target.value ? Number(e.target.value) : null)}
            placeholder="120"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1">
            계정 유형<span className="text-xs text-charcoal-light/60 font-normal ml-2">(중복선택 가능)</span>
          </label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {CATEGORIES.map((cat) => {
              const checked = selectedCategories.includes(cat.value);
              return (
                <label key={cat.value} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${checked ? "border-sage bg-sage/5" : "border-border-soft bg-white/40 hover:bg-white/60"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat.value)} className="mt-0.5 w-4 h-4 rounded text-sage focus:ring-sage/30" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{cat.icon}</span>
                      <span className={`text-sm font-medium ${checked ? "text-sage-dark" : "text-charcoal"}`}>{cat.label}</span>
                    </div>
                    <p className="text-xs text-charcoal-light/70 mt-0.5">{cat.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="col-span-2">
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-2xl border border-border-soft bg-white/40 hover:bg-white/60 transition-colors">
            <input type="checkbox" checked={data.is_niche_account} onChange={(e) => update("is_niche_account", e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-border-soft text-sage focus:ring-sage/30" />
            <div>
              <p className="text-sm font-medium text-charcoal">전문특화 계정</p>
              <p className="text-xs text-charcoal-light/70 mt-0.5">특정 지역·매물 타입만 다루는 계정 — 팔로워·좋아요 수가 적어도 AI가 정상으로 처리합니다</p>
            </div>
          </label>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="px-6 py-2.5 rounded-2xl border border-border-soft text-charcoal-light font-medium hover:bg-white/80 transition-colors">
            ← 목록으로
          </button>
        ) : <div />}
        <button
          type="button"
          onClick={handleNext}
          disabled={uploading}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음 (수동 입력)
        </button>
      </div>
    </GlassCard>
  );
}
