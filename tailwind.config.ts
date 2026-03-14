import type { Config } from "tailwindcss";

function pmColor(varName: string) {
  return `rgb(var(--pm-${varName}) / <alpha-value>)`;
}

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
          bg: pmColor("bg"),
          card: pmColor("card"),
          text: pmColor("text"),
          muted: pmColor("muted"),
          border: pmColor("border"),
          complete: pmColor("complete"),
          "in-progress": pmColor("in-progress"),
          "not-started": pmColor("not-started"),
          blocked: pmColor("blocked"),
          "on-hold": pmColor("on-hold"),
          pending: pmColor("pending"),
          accent: pmColor("accent"),
          "accent-hover": pmColor("accent-hover"),
          surface: pmColor("surface"),
        },
      },
    },
  },
  plugins: [],
};

export default config;
