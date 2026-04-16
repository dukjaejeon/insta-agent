"use client";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({
  children,
  className = "",
  padding = "md",
}: GlassCardProps) {
  return (
    <div
      className={`
        bg-white/60 backdrop-blur-xl
        border border-white/40
        rounded-3xl
        shadow-glass
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
