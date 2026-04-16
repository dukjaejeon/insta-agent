import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "var(--bg-primary)",
        "bg-card": "var(--bg-card)",
        sage: {
          DEFAULT: "var(--sage)",
          light: "var(--sage-light)",
          dark: "var(--sage-dark)",
        },
        charcoal: {
          DEFAULT: "var(--charcoal)",
          light: "var(--charcoal-light)",
        },
        "border-soft": "var(--border-soft)",
      },
      fontFamily: {
        sans: ["Inter", "Pretendard", "sans-serif"],
        pretendard: ["Pretendard", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
