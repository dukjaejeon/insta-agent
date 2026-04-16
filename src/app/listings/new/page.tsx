"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navigation } from "@/components/layout/Navigation";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { GlassCard } from "@/components/ui/GlassCard";
import { createClient, getCurrentUserId } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";

type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

const PRICE_TYPES = [
  { value: "sale", label: "매매" },
  { value: "jeonse", label: "전세" },
  { value: "monthly", label: "월세" },
];

const DISTRICTS = ["도봉구", "노원구", "강북구", "의정부시"];

const DIRECTIONS = ["남향", "남동향", "남서향", "동향", "서향", "북향", "북동향", "북서향"];

export default function NewListingPage() {
  return (
    <Suspense>
      <NewListingForm />
    </Suspense>
  );
}

function NewListingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultPlaybookId = searchParams.get("playbook_id");

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    district: "",
    dong: "",
    complex_name: "",
    size_pyeong: "",
    floor: "",
    direction: "",
    price_type: "sale",
    sale_price: "",
    jeonse_price: "",
    deposit: "",
    monthly: "",
    features: [] as string[],
    raw_memo: "",
  });
  const [featureInput, setFeatureInput] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddFeature = () => {
    const val = featureInput.trim();
    if (val && !form.features.includes(val)) {
      setForm((prev) => ({ ...prev, features: [...prev.features, val] }));
      setFeatureInput("");
    }
  };

  const handleRemoveFeature = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== idx),
    }));
  };

  const buildPriceInfo = () => {
    if (form.price_type === "sale") {
      return { type: "sale", sale_price: Number(form.sale_price) || null };
    }
    if (form.price_type === "jeonse") {
      return { type: "jeonse", jeonse_price: Number(form.jeonse_price) || null };
    }
    return {
      type: "monthly",
      deposit: Number(form.deposit) || null,
      monthly: Number(form.monthly) || null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const supabase = createClient();
    const user = { id: getCurrentUserId() };

    const payload: ListingInsert = {
      user_id: user.id,
      title: form.title || null,
      district: form.district || null,
      dong: form.dong || null,
      complex_name: form.complex_name || null,
      size_pyeong: form.size_pyeong ? Number(form.size_pyeong) : null,
      floor: form.floor ? Number(form.floor) : null,
      direction: form.direction || null,
      price_info: buildPriceInfo(),
      features: form.features.length > 0 ? form.features : null,
      raw_memo: form.raw_memo || null,
      status: "active",
    };

    const { data, error } = await supabase
      .from("listings")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      console.error("매물 저장 실패:", error);
      return;
    }

    // playbook_id가 있으면 바로 제안 생성 요청
    if (defaultPlaybookId && data?.id) {
      router.push(`/listings/${data.id}?propose=true&playbook_id=${defaultPlaybookId}`);
    } else if (data?.id) {
      router.push(`/listings/${data.id}`);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-bg-primary">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <h1 className="text-2xl font-bold text-charcoal mb-6">새 매물 등록</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 기본 정보 */}
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">기본 정보</h2>
              <div className="space-y-3">
                <FormField label="제목 (선택)">
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="예: 도봉구 쌍문동 쾌적한 남향 아파트"
                    className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="구/시 *">
                    <select
                      name="district"
                      value={form.district}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    >
                      <option value="">선택</option>
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="동">
                    <input
                      name="dong"
                      value={form.dong}
                      onChange={handleChange}
                      placeholder="예: 쌍문동"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                </div>

                <FormField label="단지명">
                  <input
                    name="complex_name"
                    value={form.complex_name}
                    onChange={handleChange}
                    placeholder="예: 쌍문한신아파트"
                    className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                </FormField>

                <div className="grid grid-cols-3 gap-3">
                  <FormField label="평수">
                    <input
                      name="size_pyeong"
                      type="number"
                      value={form.size_pyeong}
                      onChange={handleChange}
                      placeholder="예: 25"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                  <FormField label="층수">
                    <input
                      name="floor"
                      type="number"
                      value={form.floor}
                      onChange={handleChange}
                      placeholder="예: 7"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                  <FormField label="향">
                    <select
                      name="direction"
                      value={form.direction}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    >
                      <option value="">선택</option>
                      {DIRECTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </div>
            </GlassCard>

            {/* 가격 정보 */}
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">가격 정보</h2>
              <div className="space-y-3">
                <div className="flex gap-2 mb-2">
                  {PRICE_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, price_type: pt.value }))}
                      className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                        form.price_type === pt.value
                          ? "bg-sage text-white"
                          : "border border-border-soft text-charcoal-light hover:bg-white/80"
                      }`}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>

                {form.price_type === "sale" && (
                  <FormField label="매매가 (만원)">
                    <input
                      name="sale_price"
                      type="number"
                      value={form.sale_price}
                      onChange={handleChange}
                      placeholder="예: 45000 (4억 5천만원)"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                )}

                {form.price_type === "jeonse" && (
                  <FormField label="전세가 (만원)">
                    <input
                      name="jeonse_price"
                      type="number"
                      value={form.jeonse_price}
                      onChange={handleChange}
                      placeholder="예: 30000 (3억)"
                      className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                    />
                  </FormField>
                )}

                {form.price_type === "monthly" && (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="보증금 (만원)">
                      <input
                        name="deposit"
                        type="number"
                        value={form.deposit}
                        onChange={handleChange}
                        placeholder="예: 1000"
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </FormField>
                    <FormField label="월세 (만원)">
                      <input
                        name="monthly"
                        type="number"
                        value={form.monthly}
                        onChange={handleChange}
                        placeholder="예: 80"
                        className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                      />
                    </FormField>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* 특징 */}
            <GlassCard>
              <h2 className="text-base font-semibold text-charcoal mb-4">매물 특징</h2>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddFeature())}
                    placeholder="예: 역세권, 햇빛 잘 듦, 리모델링 완료"
                    className="flex-1 px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30"
                  />
                  <button
                    type="button"
                    onClick={handleAddFeature}
                    className="px-3 py-2 rounded-xl bg-sage/10 text-sage-dark text-sm font-medium hover:bg-sage/20 transition-colors"
                  >
                    추가
                  </button>
                </div>
                {form.features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.features.map((f, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-light/20 text-sage-dark text-sm"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() => handleRemoveFeature(i)}
                          className="text-sage-dark/60 hover:text-sage-dark"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <FormField label="메모 (AI가 콘텐츠 생성 시 참고)">
                  <textarea
                    name="raw_memo"
                    value={form.raw_memo}
                    onChange={handleChange}
                    rows={4}
                    placeholder="집주인 사정, 특이사항, 강조하고 싶은 포인트 등을 자유롭게 입력하세요"
                    className="w-full px-3 py-2 rounded-xl border border-border-soft bg-white/60 text-charcoal text-sm focus:outline-none focus:ring-2 focus:ring-sage/30 resize-none"
                  />
                </FormField>
              </div>
            </GlassCard>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-2.5 rounded-2xl border border-border-soft text-charcoal-light font-medium hover:bg-white/80 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-2xl bg-sage text-white font-medium hover:bg-sage-dark transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : "매물 저장 →"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </AuthGuard>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-charcoal-light mb-1">{label}</label>
      {children}
    </div>
  );
}
