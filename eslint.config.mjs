import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    globalIgnores([
        "**/.config.js",
        "**/.eslintrc.cjs",
        "**/vitest.config.js",
        "src/scripts/test.ts",
    ]),
    {
        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended-type-checked",
            "plugin:@typescript-eslint/recommended-requiring-type-checking",
        ),

        plugins: {
            "@typescript-eslint": typescriptEslint,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 5,
            sourceType: "script",

            parserOptions: {
                project: true,
                tsconfigRootDir: "/Users/joshcanhelp/Code/pdpl/pdpl-cli",
            },
        },

        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-floating-promises": "warn",
            "@typescript-eslint/no-misused-promises": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-argument": "warn",
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-array-delete": "warn",
            "@typescript-eslint/no-unused-expressions": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    caughtErrors: "none",
                },
            ],
        },
    },
    {
        files: ["**/*.spec.*"],
        rules: {
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/require-await": "off",
            "@typescript-eslint/unbound-method": "off",
        },
    },
]);
