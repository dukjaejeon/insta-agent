"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient } from "@/lib/supabase/client";

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

export function Step1AccountInfo({ data, onChange, onNext }: Step1Props) {
  const [ocrLoading, setOcrLoading] = useState(false);

  const handleProfileScreenshot = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const path = `${user.id}/profile-temp/${Date.now()}-${file.name}`;
      await supabase.storage.from("screenshots").upload(path, file);

      const { data: fnData, error } = await supabase.functions.invoke(
        "ocr-extract-posts",
        {
          body: {
            account_id: null,
            screenshots: [
              { storage_path: path, screenshot_type: "profile" },
            ],
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
      }
    } catch {
      // OCR 실패 시 수동 입력 유지
    } finally {
      setOcrLoading(false);
    }
  };

  const update = (field: keyof AccountData, value: string | number | boolean | null) => {
    onChange({ ...data, [field]: value });
  };

  const canProceed = data.handle.trim().length > 0;

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-6">
        Step 1. 계정 정보
      </h2>

      {/* 프로필 스크린샷 OCR */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-charcoal mb-2">
          프로필 스크린샷 (선택)
        </label>
        <div className="border-2 border-dashed border-border-soft rounded-2xl p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleProfileScreenshot}
            className="hidden"
            id="profile-screenshot"
          />
          <label
            htmlFor="profile-screenshot"
            className="cursor-pointer text-sm text-charcoal-light hover:text-sage transition-colors"
          >
            {ocrLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-sage border-t-transparent rounded-full animate-spin" />
                OCR 분석 중...
              </span>
            ) : (
              "프로필 스크린샷을 올리면 자동으로 채워집니다"
            )}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            핸들 *
          </label>
          <input
            type="text"
            value={data.handle}
            onChange={(e) => update("handle", e.target.value)}
            placeholder="@grace_zip_"
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            표시 이름
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
            바이오
          </label>
          <textarea
            value={data.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal placeholder:text-charcoal-light/50 focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            팔로워
          </label>
          <input
            type="number"
            value={data.follower_count ?? ""}
            onChange={(e) =>
              update("follower_count", e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            팔로잉
          </label>
          <input
            type="number"
            value={data.following_count ?? ""}
            onChange={(e) =>
              update("following_count", e.target.value ? Number(e.target.value) : null)
            }
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
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal mb-1.5">
            카테고리
          </label>
          <select
            value={data.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-border-soft bg-white/80 text-charcoal focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage transition-colors"
          >
            <option value="">선택</option>
            <option value="고급">고급</option>
            <option value="중산">중산</option>
            <option value="대중">대중</option>
            <option value="니치">니치</option>
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
              니치 계정 (부동산처럼 engagement가 낮은 것이 정상인 계정)
            </span>
          </label>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음
        </button>
      </div>
    </GlassCard>
  );
}
