// 依赖只能向内：ui → store → data/entitlements → core。违反直接报错，CI 会红。
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["out/**", "dist/**", "node_modules/**", "renderer/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries, "react-hooks": reactHooks },
    settings: {
      "boundaries/elements": [
        { type: "core", pattern: "src/core/**" },
        { type: "entitlements", pattern: "src/entitlements/**" },
        { type: "data", pattern: "src/data/**" },
        { type: "platform", pattern: "src/platform/**" },
        { type: "store", pattern: "src/store/**" },
        { type: "primitives", pattern: "src/ui/primitives/**" },
        { type: "styles", pattern: "src/ui/styles/**" },
        { type: "widgets", pattern: "src/ui/widgets/**" },
        { type: "feature", pattern: "src/ui/features/*/**", capture: ["name"] },
        { type: "app", pattern: "src/app/**" },
        { type: "entry", pattern: "src/main.tsx" },
      ],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "core", allow: ["core"] },
            { from: "entitlements", allow: ["entitlements", "core"] },
            { from: "data", allow: ["data", "core"] },
            { from: "platform", allow: ["platform", "core"] },
            { from: "store", allow: ["store", "core", "data", "entitlements", "platform"] },
            { from: "primitives", allow: ["primitives", "styles"] },
            { from: "widgets", allow: ["widgets", "core", "store", "entitlements", "platform", "primitives"] },
            /* 功能模块只能引自己目录，互相不许 import */
            { from: "feature", allow: [["feature", { name: "${from.name}" }], "core", "store", "entitlements", "platform", "primitives", "widgets"] },
            { from: "app", allow: ["app", "core", "store", "entitlements", "platform", "primitives", "styles", "feature", "widgets"] },
            { from: "entry", allow: ["app", "store", "data", "platform", "styles", "core"] },
          ],
        },
      ],
    },
  },
);
