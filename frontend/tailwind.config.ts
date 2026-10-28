import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F3864",
        brand: "#2E5C8A",
      },
    },
  },
  plugins: [],
} satisfies Config;
