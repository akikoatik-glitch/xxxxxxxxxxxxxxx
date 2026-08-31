import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#06291F",
          900: "#0B3D2E",
          850: "#0E4A37",
          800: "#11573F",
          700: "#14734F",
          600: "#17855C",
          500: "#1D9D6C"
        },
        grass: {
          200: "#C6F0DC",
          300: "#86E0B8",
          400: "#34D399",
          500: "#10B981"
        },
        white: "#FFFFFF",
        muted: "#67736A",
        red: "#D64545",
        amber: "#E08B16",
        bg: "#FAF7F0",
        surface: "#FFFFFF",
        elevated: "#F4F0E6",
        line: "#EAE4D8",
        accent: "#10B981",
        "accent-strong": "#0E9E6E",
        ink: "#12231B",
        mute: "#67736A",
        success: "#16A34A",
        warning: "#E08B16",
        danger: "#D64545",
        royal: "#C8961E",
        gold: "#C8961E"
      },
      fontFamily: {
        display: ["var(--font-oswald)", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"]
      },
      boxShadow: {
        glow: "0 0 28px -8px rgba(52, 211, 153, 0.4)",
        "glow-gold": "0 0 28px -8px rgba(245, 158, 11, 0.45)",
        card: "0 18px 44px -18px rgba(0, 0, 0, 0.75)",
        inner3d: "inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px -14px rgba(0,0,0,0.7)"
      },
      backgroundImage: {
        "pitch-faint":
          "linear-gradient(rgba(52, 211, 153, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(52, 211, 153, 0.045) 1px, transparent 1px)"
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "70%": { transform: "scale(1.2)", opacity: "0.2" },
          "100%": { transform: "scale(1.32)", opacity: "0" }
        },
        "pitch-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "60%": { boxShadow: "0 0 0 18px rgba(52,211,153,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52,211,153,0)" }
        },
        "gold-glow": {
          "0%,100%": { filter: "drop-shadow(0 0 4px rgba(245,158,11,0.6))" },
          "50%": { filter: "drop-shadow(0 0 8px rgba(245,158,11,0.9))" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "ball-spin": {
          from: { transform: "rotate3d(1, 1, 0, 0deg)" },
          to: { transform: "rotate3d(1, 1, 0, 360deg)" }
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        "pulse-ring-slow": "pulse-ring 2.4s cubic-bezier(0.2, 0.6, 0.4, 1) infinite 0.9s",
        "pitch-pulse": "pitch-pulse 1.6s ease-out 2 forwards",
        "gold-glow": "gold-glow 2.4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 14s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "ball-spin": "ball-spin 1.5s linear infinite",
        "fade-up": "fade-up 0.5s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;