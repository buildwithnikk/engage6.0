import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1F3864",
        brand: "#2E5C8A",
        saffron: "#FF9933",
        leaf: "#138808",
      },
    },
  },
  plugins: [],
} satisfies Config;
