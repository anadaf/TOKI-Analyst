import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        alef: {
          teal: "#1CC5C8",
          navy: "#1B2B45",
          bg: "#F2F4F7",
          border: "#E4E7EC",
          text: "#1E2A3B",
          muted: "#8A94A6",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
