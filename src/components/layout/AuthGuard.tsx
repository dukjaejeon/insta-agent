"use client";

interface AuthGuardProps {
  children: React.ReactNode;
}

// 단일 사용자 로컬 도구: 인증 체크 없이 바로 렌더링
export function AuthGuard({ children }: AuthGuardProps) {
  return <>{children}</>;
}
