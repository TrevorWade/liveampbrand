// This file configures Tailwind CSS to scan all files in the src directory.
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Keep in sync with --brand-blue in globals.css and BRAND_BLUE in src/lib/brand.ts.
      colors: {
        brand: {
          blue: "#8AD4E1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
