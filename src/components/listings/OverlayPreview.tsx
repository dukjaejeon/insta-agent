"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface OverlayConfig {
  backgroundImageUrl?: string;
  headline: string;
  subtext?: string;
  priceText?: string;
  locationText?: string;
  overlayStyle: "dark" | "light" | "gradient";
  brandColor?: string;
}

interface OverlayPreviewProps {
  config: OverlayConfig;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1080;

export function OverlayPreview({
  config,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: OverlayPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // 배경
    if (config.backgroundImageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = config.backgroundImageUrl!;
        });
        // 이미지를 캔버스 중앙에 커버 방식으로 그리기
        const imgRatio = img.width / img.height;
        const canvasRatio = width / height;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (imgRatio > canvasRatio) {
          sw = img.height * canvasRatio;
          sx = (img.width - sw) / 2;
        } else {
          sh = img.width / canvasRatio;
          sy = (img.height - sh) / 2;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      } catch {
        // 이미지 로드 실패 시 기본 배경
        ctx.fillStyle = "#F7F6F2";
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = "#F7F6F2";
      ctx.fillRect(0, 0, width, height);
    }

    // 오버레이
    if (config.overlayStyle === "dark") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, width, height);
    } else if (config.overlayStyle === "light") {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(0, 0, width, height);
    } else {
      // gradient — bottom to top
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, "rgba(0,0,0,0.75)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.20)");
      grad.addColorStop(1, "rgba(0,0,0,0.0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    const brandColor = config.brandColor ?? "#87A96B";
    const textColor =
      config.overlayStyle === "light" ? "#2D3436" : "#FFFFFF";

    // 브랜드 컬러 악센트 바
    ctx.fillStyle = brandColor;
    ctx.fillRect(80, height - 200, 6, 100);

    // 헤드라인
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(width * 0.07)}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
    ctx.textAlign = "left";

    const headlineX = 110;
    const headlineMaxWidth = width - 160;
    wrapText(ctx, config.headline, headlineX, height - 160, headlineMaxWidth, Math.round(width * 0.09));

    // 서브텍스트
    if (config.subtext) {
      ctx.font = `${Math.round(width * 0.038)}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.fillStyle =
        config.overlayStyle === "light"
          ? "rgba(45,52,54,0.7)"
          : "rgba(255,255,255,0.8)";
      ctx.fillText(config.subtext, headlineX, height - 90, headlineMaxWidth);
    }

    // 가격
    if (config.priceText) {
      ctx.font = `bold ${Math.round(width * 0.05)}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.fillStyle = brandColor;
      ctx.textAlign = "right";
      ctx.fillText(config.priceText, width - 80, height - 120);
    }

    // 위치
    if (config.locationText) {
      ctx.font = `${Math.round(width * 0.032)}px "Pretendard", "Apple SD Gothic Neo", sans-serif`;
      ctx.fillStyle =
        config.overlayStyle === "light"
          ? "rgba(45,52,54,0.6)"
          : "rgba(255,255,255,0.65)";
      ctx.textAlign = "right";
      ctx.fillText(config.locationText, width - 80, height - 70);
    }
  }, [config, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleDownload = async () => {
    setDownloading(true);
    await draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `insta-overlay-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloading(false);
  };

  const previewScale = 360 / width;

  return (
    <div className="space-y-3">
      <div
        className="relative rounded-2xl overflow-hidden border border-border-soft bg-cream"
        style={{ width: 360, height: Math.round(height * previewScale) }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: 360,
            height: Math.round(height * previewScale),
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="w-full py-2.5 rounded-2xl border border-sage text-sage-dark text-sm font-medium hover:bg-sage/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {downloading ? "저장 중..." : "PNG 다운로드 (1080×1080)"}
      </button>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[i] + " ";
      currentY -= lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}
