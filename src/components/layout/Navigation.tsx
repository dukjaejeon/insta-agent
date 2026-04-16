"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/benchmarks", label: "벤치마크" },
  { href: "/listings", label: "매물" },
  { href: "/calendar", label: "캘린더" },
  { href: "/settings", label: "설정" },
  { href: "/export", label: "내보내기" },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/60 backdrop-blur-xl border-b border-border-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-sage-dark">InstaAgent</span>
        </Link>

        {/* 데스크톱 메뉴 */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-sage/10 text-sage-dark"
                    : "text-charcoal-light hover:bg-sage/5 hover:text-charcoal"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* 오른쪽 액션 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center text-charcoal-light hover:bg-sage/5 transition-colors"
            aria-label="알림"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </button>
          <div className="hidden sm:flex w-9 h-9 rounded-full bg-sage-light/40 items-center justify-center">
            <span className="text-sm font-medium text-sage-dark">U</span>
          </div>

          {/* 모바일 햄버거 */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-charcoal-light hover:bg-sage/5 transition-colors"
            aria-label="메뉴"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 모바일 드롭다운 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border-soft bg-white/80 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sage/10 text-sage-dark"
                      : "text-charcoal-light hover:bg-sage/5 hover:text-charcoal"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
