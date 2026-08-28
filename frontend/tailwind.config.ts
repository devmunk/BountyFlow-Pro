import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "bf-black": "#050a06",
        "bf-black-soft": "#0a120c",
        "bf-panel": "#0f1a12",
        "bf-border": "#1c2e1f",
        "bf-green": "#39ff88",
        "bf-green-dim": "#1f8f4d",
        "bf-green-muted": "#a8f5c4",
        "bf-amber": "#f5c542",
        "bf-red": "#ff5c5c",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "'Fira Code'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(57, 255, 136, 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
