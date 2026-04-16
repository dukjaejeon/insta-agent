interface CostBadgeProps {
  costUsd: number;
}

export function CostBadge({ costUsd }: CostBadgeProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sage-light/20 text-charcoal-light border border-sage-light/30">
      ${costUsd.toFixed(2)}
    </span>
  );
}
