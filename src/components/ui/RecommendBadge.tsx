interface RecommendBadgeProps {
  size?: "sm" | "md";
}

export function RecommendBadge({ size = "sm" }: RecommendBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        bg-amber-50 text-amber-600 border border-amber-200
        rounded-full font-medium
        ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}
      `}
    >
      <span>추천</span>
    </span>
  );
}
