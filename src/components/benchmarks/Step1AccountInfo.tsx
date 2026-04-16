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
}

const CATEGORIES = [
  { value: "프리미엄", label: "프리미엄", desc: "강남·고가 아파트 (10억+)" },
  { value: "일반", label: "일반", desc: "중간 가격대 아파트 (3~10억)" },
  { value: "실속형", label: "실속형", desc: "빌라·다세대·소형 (3억 이하)" },
  { value: "전문특화", label: "전문특화", desc: "특정 지역·타입 전문 계정" },
];

export function Step1AccountInfo({ data, onChange, onNext }: Step1Props) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "success" | "fail">("idle");

  const handleProfileScreenshot = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 미리보기 즉시 표시
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    try {
      const supabase = createClient();
      const userId = getCurrentUserId();
      const path = `${userId}/profile-temp/${Date.now()}-${file.name}`;
      await supabase.storage.from("screenshots").upload(path, file);

      // API 키 있으면 OCR 자동 추출
      const { data: fnData, error } = await supabase.functions.invoke(
        "ocr-extract-posts",
        {
          body: {
            account_id: null,
            screenshots: [{ storage_path: path, screenshot_type: "profile" }],
          },
        }
      );

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

  const update = (field: keyof AccountData, value: string | number | boolean | null) => {
    onChange({ ...data, [field]: value });
  };

  const [handleError, setHandleError] = useState(false);

  const handleNext = () => {
    if (!data.handle.trim()) {
      setHandleError(true);
      return;
    }
    setHandleError(false);
    onNext();
  };

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">
        Step 1. 계정 정보
      </h2>

      {/* 프로필 스크린샷 업로드 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-charcoal mb-2">
          프로필 스크린샷
          <span className="text-xs text-charcoal-light/60 font-normal ml-2">
            (사진 올리면 자동 입력)
          </span>
        </label>

        <label
          htmlFor="profile-screenshot"
          className="cursor-pointer block"
        >
          {previewUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-border-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="프로필 스크린샷"
                className="w-full max-h-48 object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm">분석 중...</span>
                </div>
              )}
              {!uploading && (
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                  탭하여 교체
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border-soft rounded-2xl p-8 text-center hover:border-sage/40 transition-colors">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-sage/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-charcoal">사진 업로드</p>
              <p className="text-xs text-charcoal-light/60 mt-1">
                인스타그램 프로필 스크린샷
              </p>
            </div>
          )}
        </label>
        {ocrStatus === "fail" && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ 자동 입력 실패 — 아래에 직접 입력해주세요
          </p>
        )}
        {ocrStatus === "success" && (
          <p className="text-xs text-sage-dark mt-2">
            ✓ 자동 입력 완료 — 내용을 확인하고 수정하세요
          </p>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleProfileScreenshot}
          className="hidden"
          id="profile-screenshot"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            인스타 아이디 *
          </label>
          <input
            type="text"
            value={data.handle}
            placeholder="@grace_zip_"
            onChange={(e) => { update("handle", e.target.value); setHandleError(false); }}
            className={`w-full px-4 py-3 rounded-2xl border bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 transition-colors ${handleError ? "border-red-400 focus:ring-red-300" : "border-border-soft focus:border-sage"}`}
          />
          {handleError && (
            <p className="text-xs text-red-500 mt-1">인스타 아이디를 입력해주세요</p>
          )}
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            계정 이름
          </label>
          <input
            type="text"
            value={data.display_name}
            onChange={(e) => update("display_name", e.target.value)}
            placeholder="은혜 부동산"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            계정 소개글
          </label>
          <textarea
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            placeholder="인스타 프로필 소개글"
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            팔로워 수
          </label>
          <input
            type="number"
            value={data.follower_count ?? ""}
            onChange={(e) =>
              update("follower_count", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="3200"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            게시물 수
          </label>
          <input
            type="number"
            value={data.post_count ?? ""}
            onChange={(e) =>
              update("post_count", e.target.value ? Number(e.target.value) : null)
            }
            placeholder="120"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            계정 유형
            <span className="text-xs text-charcoal-light/60 font-normal ml-2">
              (바이럴 기준 설정에 사용)
            </span>
          </label>
          <select
            value={data.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          >
            <option value="">선택하세요</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label} — {cat.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={data.is_niche_account}
              onChange={(e) => update("is_niche_account", e.target.checked)}
              className="w-5 h-5 rounded-lg border-border-soft text-sage focus:ring-sage/30"
            />
            <span className="text-sm text-charcoal">
              전문 특화 계정 <span className="text-charcoal-light/60">(좋아요·댓글이 적어도 정상인 계정)</span>
            </span>
          </label>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={uploading}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음
        </button>
      </div>
    </GlassCard>
  );
}
