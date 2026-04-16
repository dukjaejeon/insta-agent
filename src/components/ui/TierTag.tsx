interface TierTagProps {
  tier: "viral" | "high_performer" | "standard";
}

const tierConfig = {
  viral: { label: "Viral", className: "bg-red-50 text-red-600 border-red-200" },
  high_performer: {
    label: "High",
    className: "bg-blue-50 text-blue-600 border-blue-200",
  },
  standard: {
    label: "Standard",
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

export function TierTag({ tier }: TierTagProps) {
  const config = tierConfig[tier];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
