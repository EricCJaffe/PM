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
        pm: {
          bg: "#0f172a",
          card: "#1e293b",
          text: "#e2e8f0",
          muted: "#94a3b8",
          border: "#334155",
          complete: "#10b981",
          "in-progress": "#f59e0b",
          "not-started": "#475569",
          blocked: "#ef4444",
          "on-hold": "#6366f1",
          pending: "#8b5cf6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
