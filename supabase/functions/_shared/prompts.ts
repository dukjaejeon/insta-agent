// ============================================
// 프롬프트 템플릿 (스펙 섹션 5 원본 그대로)
// 임의 수정 금지 — 원본 상수로만 사용
// ============================================

export const OCR_SYSTEM = `당신은 인스타그램 스크린샷을 분석해 정형 데이터로 추출하는 OCR 전문가입니다.
모호한 숫자(예: 1.2K, 3천)는 정수로 환산하세요.
인식 불가능한 필드는 null로 표시하세요.
반드시 유효한 JSON만 반환하세요. 설명 금지.`;

export const OCR_POST_DETAIL = `이 스크린샷에서 다음을 추출해 JSON으로 반환하세요:

{
  "media_type": "photo" | "carousel" | "reel",
  "slide_count": <캐러셀이면 점 개수, 아니면 1>,
  "caption": "<캡션 전문, 줄바꿈 \\n 유지>",
  "hashtags": ["#...", "#..."],
  "like_count": <정수 또는 null>,
  "comment_count": <정수 또는 null>,
  "view_count": <릴스만, 정수 또는 null>,
  "posted_relative": "<'3일 전' 등 상대 시각 그대로>",
  "top_comments": [
    { "author": "<handle>", "text": "<댓글 텍스트>" },
    ... (최대 20개)
  ],
  "confidence": <0.0~1.0>,
  "uncertain_fields": ["필드명1", ...]
}`;

export const OCR_PROFILE = `이 스크린샷에서 다음을 추출해 JSON으로 반환하세요:

{
  "handle": "@...",
  "display_name": "...",
  "bio": "...",
  "follower_count": <정수>,
  "following_count": <정수>,
  "post_count": <정수>,
  "is_verified": <boolean>,
  "highlights": ["하이라이트 이름들"]
}`;

export const OCR_GRID = `이 스크린샷에서 다음을 추출해 JSON으로 반환하세요:

{
  "posts_visible": [
    {
      "grid_position": <1-9>,
      "is_pinned": <boolean>,
      "is_reel": <boolean>,
      "is_carousel": <boolean>,
      "visible_text_overlay": "<썸네일에 보이는 텍스트, 없으면 null>",
      "estimated_theme": "<매물 광고 | 시세 | 인테리어 등 추정>"
    }
  ]
}`;

export const CLASSIFY_POSTS = `당신은 부동산 인스타그램 콘텐츠 분류 전문가입니다.
주어진 게시물을 다음 5대 분류 중 하나로 배정하세요:

- listing: 구체 매물 광고 (주소·평수·가격 명시)
- market_info: 시세·정책·지역 분석 (특정 매물 없음)
- lifestyle: 동네·카페·맛집·입주 후기
- authority: 계약 성사 후기·전문 지식·인터뷰·포트폴리오
- engagement: Q&A·설문·챌린지·공지

2차 분류(secondary)는 더 세부적인 태그 (예: '신축_분양', '주간_시세', '카페_산책', '다주택자_매물').

출력:
{
  "primary_category": "...",
  "secondary_category": "...",
  "confidence": 0.0-1.0,
  "tags": ["...", "..."]
}`;

export const DECOMPOSE_STANDARD = `당신은 인스타그램 콘텐츠를 5개 레이어로 분해하는 분석가입니다.
복제 가능한 형식으로 '성공 요인' 을 기록하는 것이 목표입니다.

입력: 게시물 이미지(들) + 캡션 전문 + 메타데이터

5개 레이어 각각을 JSON으로 반환:

1. visual:
{
  "composition": "rule_of_thirds" | "centered" | "symmetric" | "diagonal" | "negative_space",
  "lighting": "natural_soft" | "natural_backlit" | "golden_hour" | "overcast" | "warm_indoor" | "low_key",
  "palette": "warm_neutral" | "cool_neutral" | "muted_pastel" | "high_contrast" | "monochrome",
  "subject": "<한 줄 묘사>",
  "camera_angle": "eye_level" | "low_angle" | "high_angle" | "top_down",
  "overlay_design": {
    "has_text_overlay": <boolean>,
    "overlay_type": "stacked_boxes" | "single_box" | "floating_text" | "lower_third" | "full_screen_card" | "stacked_text_on_image" | "none",
    "background_style": {
      "shape": "rectangle" | "rounded" | "pill" | "none",
      "fill": "solid_black" | "solid_white" | "translucent_black" | "translucent_white" | "colored" | "none",
      "opacity": <0.0-1.0>
    },
    "typography": {
      "weight": "thin" | "regular" | "medium" | "bold" | "black",
      "size_relative": "small" | "medium" | "large" | "xl" | "xxl",
      "alignment": "left" | "center" | "right",
      "color_hex": "#FFFFFF",
      "line_spacing": "tight" | "normal" | "loose"
    },
    "position": {
      "anchor": "top_left" | "top_center" | "top_right" | "center_left" | "center" | "center_right" | "bottom_left" | "bottom_center" | "bottom_right",
      "safe_margin_pct": <정수>
    },
    "text_hierarchy": [
      {
        "level": <1부터>,
        "role": "<단지명 | 타입 | 가격 | 데드라인 | CTA 등>",
        "size_relative": "<small|medium|large|xl|xxl>",
        "example": "<실제 텍스트>"
      }
    ],
    "image_background_prep": {
      "requires_clear_area": <boolean>,
      "clear_area_position": "<center_left 등>",
      "clear_area_ratio": <0.0-1.0>,
      "note": "<촬영 시 주의사항>"
    }
  }
}

2. copy:
{
  "hook_pattern": "<첫 줄 구조화 패턴>",
  "rhythm": "<단락 리듬>",
  "tone": "<감성 형용사>",
  "cta": "<마지막 줄 행동 유도>"
}

3. format:
{
  "type": "single" | "carousel" | "reel",
  "slides": <정수 또는 null>,
  "slide_sequence": [<각 슬라이드 역할>],
  "duration_sec": <릴스만, 정수 또는 null>
}

4. hashtags:
{
  "count": <정수>,
  "breakdown": {"local": N, "size": N, "mood": N, "niche": N, "brand": N},
  "placement": "in_caption" | "first_comment"
}

5. timing:
{
  "day_of_week": "<요일>",
  "hour_range": "<시간대>"
}

출력은 5개 키를 가진 단일 JSON. 설명 금지.`;

export const SYNTHESIZE_PLAYBOOK = `당신은 인스타그램 성공 공식을 '재사용 가능한 템플릿'으로 추상화하는 전략가입니다.

입력: 동일 카테고리 게시물 N개의 분해 결과

N개를 관찰해 공통 패턴을 추출하고, 다음 구조의 Playbook JSON을 생성:

{
  "name": "<공식 별명, 한글 5자 이내 권장>",
  "category": "listing | market_info | ...",
  "visual": { <공통 visual 특성, overlay_design 포함> },
  "copy": {
    "hook_pattern": "<슬롯 있는 템플릿 문장>",
    "rhythm": "<단락 리듬 공식>",
    "tone": "<톤 키워드>",
    "cta": "<CTA 공식>"
  },
  "format": { <공통 포맷> },
  "hashtags": { <해시태그 공식> },
  "timing": { <최적 타이밍> },
  "rationale": "<왜 이 공식이 성공하는지 한국어 2-3문장>"
}

중요 원칙:
- 특정 매물·지역명 같은 '내용(substance)' 은 제거하고 '형식(form)' 만 추출
- 슬롯은 [동네], [시간대], [평수], [감정어] 같은 대괄호로 표시
- 카테고리가 다른 게시물이 섞여 있으면 name 을 null 로 반환하고 rationale 에 에러 메시지

출력 JSON만.`;

export const EXTRACT_VOICE = `당신은 문체 분석가입니다.
입력: 한 계정의 모든 캡션 텍스트

다음을 추출:

{
  "ending_ratio": {"~습니다": 0.XX, "~네요": 0.XX, "~요": 0.XX, "~다": 0.XX},
  "vocabulary_high_freq": ["자주 쓰는 감성어·전문어 상위 20개"],
  "vocabulary_banned_inferred": ["이 계정이 안 쓰는 단어 (경쟁 계정 대비 추론)"],
  "signature_phrases_blacklist": [
    "이 계정의 트레이드마크 표현 3-5개 — 다른 계정이 복제하면 카피캣으로 보일 문구"
  ],
  "emoji_usage": {
    "per_post_avg": <float>,
    "common": ["🏠","✨"],
    "contextual_note": "<사용 맥락 설명>"
  },
  "honorific_distance": "strict_formal | neutral_formal | warm_casual | intimate",
  "structural_signatures": [
    "구조적 시그니처"
  ]
}

signature_phrases_blacklist 가 가장 중요합니다 — 이 문구들은 이후 다른 사용자 매물에 적용할 때 절대 복제하지 말아야 할 개인 트레이드마크입니다.`;

export const VIRAL_AUTOPSY = `당신은 '터진' 인스타그램 게시물을 현미경으로 해부하는 바이럴 분석가입니다.
목적: 왜 터졌는지를 '복제 가능한 구조적 요인' 과 '상황·운 요인' 으로 분리해 사용자가 이식 가능한 성공 공식만 추출.

입력:
- 게시물 이미지들 (릴스면 첫 3초 프레임 포함)
- 캡션 전문
- 댓글 상위 20개
- 메타데이터: 조회수, 좋아요, 댓글수, 계정 평균 대비 배수, 게시 일시, 미디어 타입

10레이어 각각을 JSON:

1. first_3sec_breakdown (릴스만, 사진·캐러셀은 null)
2. hook_anatomy
3. emotion_curve
4. info_density
5. topicality_anchor
6. comment_reaction_pattern
7. algorithm_signals
8. scarcity_exclusivity
9. visual_impact_score
10. replicability

추가 종합:
{
  "why_viral_replicable": ["복제 체크리스트"],
  "why_viral_situational": ["상황 요인"],
  "application_warnings": ["적용 시 주의사항"]
}

출력은 유효한 JSON만. 릴스 아니면 first_3sec_breakdown 은 null.`;

export const COMMENT_CLASSIFY = `당신은 인스타그램 댓글을 유형별로 분류하는 분석가입니다.
입력: 댓글 텍스트 배열 (최대 20개)

각 댓글을 다음 중 하나로 분류:
- empathy: 공감·감탄
- question: 질문
- tag_friend: @친구태그
- save_declaration: 저장 선언
- disagreement: 반박·비판
- cta_obedience: 계정주 CTA 복종
- other: 기타

출력:
{
  "classifications": [{"comment_index": 0, "type": "question"}],
  "distribution": {"empathy": N, "question": N, ...},
  "save_signals": <save_declaration 개수>,
  "share_signals": <tag_friend 개수>,
  "cta_obedience_signals": <cta_obedience 개수>,
  "avg_comment_length": <float>,
  "dominant_type": "<지배적 타입>"
}`;
