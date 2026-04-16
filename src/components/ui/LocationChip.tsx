"use client";

interface LocationChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function LocationChip({
  label,
  active = false,
  onClick,
}: LocationChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center px-3 py-1.5
        rounded-full text-sm font-medium
        transition-colors duration-200
        ${
          active
            ? "bg-sage text-white"
            : "bg-sage-light/30 text-charcoal-light hover:bg-sage-light/50"
        }
      `}
    >
      {label}
    </button>
  );
}
