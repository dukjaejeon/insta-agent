interface ToneComplianceBadgeProps {
  passed: boolean;
}

export function ToneComplianceBadge({ passed }: ToneComplianceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
        passed
          ? "bg-green-50 text-green-600 border-green-200"
          : "bg-red-50 text-red-600 border-red-200"
      }`}
    >
      {passed ? "톤 준수" : "톤 불일치"}
    </span>
  );
}
