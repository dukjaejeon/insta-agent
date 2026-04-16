"use client";

import { useCallback, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";

export interface UploadedScreenshot {
  file: File;
  storagePath: string | null;
  previewUrl: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  screenshotType: "post_detail" | "grid" | "reel";
}

interface Step2Props {
  screenshots: UploadedScreenshot[];
  onScreenshotsChange: (screenshots: UploadedScreenshot[]) => void;
  accountId: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function Step2Upload({
  screenshots,
  onScreenshotsChange,
  accountId,
  onNext,
  onBack,
}: Step2Props) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const supabase = createClient();
      const userId = getCurrentUserId();

      const newScreenshots: UploadedScreenshot[] = Array.from(files).map(
        (file) => ({
          file,
          storagePath: null,
          previewUrl: URL.createObjectURL(file),
          status: "pending" as const,
          screenshotType: "post_detail" as const,
        })
      );

      const updated = [...screenshots, ...newScreenshots];
      onScreenshotsChange(updated);

      setUploading(true);
      const startIdx = screenshots.length;

      for (let i = 0; i < newScreenshots.length; i++) {
        const idx = startIdx + i;
        const file = newScreenshots[i].file;
        const path = `${userId}/${accountId || "temp"}/${Date.now()}-${i}-${file.name}`;

        updated[idx] = { ...updated[idx], status: "uploading" };
        onScreenshotsChange([...updated]);

        const { error } = await supabase.storage
          .from("screenshots")
          .upload(path, file);

        if (error) {
          updated[idx] = { ...updated[idx], status: "error" };
        } else {
          updated[idx] = {
            ...updated[idx],
            storagePath: path,
            status: "uploaded",
          };
        }
        onScreenshotsChange([...updated]);
      }

      setUploading(false);
    },
    [screenshots, onScreenshotsChange, accountId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleTypeChange = (
    idx: number,
    type: "post_detail" | "grid" | "reel"
  ) => {
    const updated = [...screenshots];
    updated[idx] = { ...updated[idx], screenshotType: type };
    onScreenshotsChange(updated);
  };

  const handleRemove = (idx: number) => {
    const updated = screenshots.filter((_, i) => i !== idx);
    onScreenshotsChange(updated);
  };

  const uploadedCount = screenshots.filter(
    (s) => s.status === "uploaded"
  ).length;

  return (
    <GlassCard padding="lg">
      <h2 className="text-lg font-semibold text-charcoal mb-2">
        Step 2. 게시물 스크린샷 업로드
      </h2>
      <p className="text-sm text-charcoal-light mb-6">
        게시물 상세 스크린샷을 드래그하여 올려주세요 (최대 50장)
      </p>

      {/* 드래그 영역 */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border-soft rounded-2xl p-8 text-center mb-6 hover:border-sage/40 transition-colors"
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          id="screenshots-upload"
        />
        <label
          htmlFor="screenshots-upload"
          className="cursor-pointer"
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-sage/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-sage"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-sm text-charcoal-light">
            클릭 또는 드래그하여 스크린샷 업로드
          </p>
          <p className="text-xs text-charcoal-light/50 mt-1">
            {uploadedCount}/50 업로드 완료
          </p>
        </label>
      </div>

      {/* 업로드된 스크린샷 그리드 */}
      {screenshots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
          {screenshots.map((shot, idx) => (
            <div
              key={idx}
              className="relative group rounded-xl overflow-hidden border border-border-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.previewUrl}
                alt={`스크린샷 ${idx + 1}`}
                className="w-full aspect-square object-cover"
              />

              {/* 상태 오버레이 */}
              {shot.status === "uploading" && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {shot.status === "uploaded" && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="w-5 h-5 rounded-full bg-sage flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
              {shot.status === "error" && (
                <div className="absolute top-1.5 right-1.5">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                </div>
              )}

              {/* 호버 컨트롤 */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <select
                  value={shot.screenshotType}
                  onChange={(e) =>
                    handleTypeChange(
                      idx,
                      e.target.value as "post_detail" | "grid" | "reel"
                    )
                  }
                  className="text-xs px-2 py-1 rounded bg-white/90 text-charcoal"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="post_detail">게시물 상세</option>
                  <option value="grid">그리드</option>
                  <option value="reel">릴스</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-xs px-2 py-1 rounded bg-red-500 text-white"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 rounded-2xl border border-border-soft text-charcoal-light font-medium hover:bg-white/80 transition-colors"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={uploading}
          className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? "업로드 중..." : "다음: 게시물 입력"}
        </button>
      </div>
    </GlassCard>
  );
}
