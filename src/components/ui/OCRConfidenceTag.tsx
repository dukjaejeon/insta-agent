interface OCRConfidenceTagProps {
  confidence: number;
  fieldName: string;
}

export function OCRConfidenceTag({ confidence, fieldName }: OCRConfidenceTagProps) {
  if (confidence >= 0.8) return null;

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700"
      title={`${fieldName} 필드 OCR 신뢰도: ${(confidence * 100).toFixed(0)}%`}
    >
      확인 필요
    </span>
  );
}
