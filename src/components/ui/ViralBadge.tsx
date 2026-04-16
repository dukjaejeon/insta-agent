interface ViralBadgeProps {
  size?: "sm" | "md";
}

export function ViralBadge({ size = "sm" }: ViralBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        bg-red-50 text-red-600 border border-red-200
        rounded-full font-medium
        ${size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}
      `}
    >
      <span>Viral</span>
    </span>
  );
}
