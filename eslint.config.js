import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "dist/**",
      "build/**",
      "scripts/**",
      "*.min.js",
      "next-env.d.ts"
    ],
  },
  ...next,
  {
    // Regla global (no necesita plugin)
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Reglas nuevas y estrictas del React Compiler (eslint-plugin-react-hooks)
      // que Next 16 activa como error. Las dejamos como aviso: marcan deuda
      // técnica real a vigilar, pero no deben bloquear build ni CI de golpe.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // Reglas de @typescript-eslint: el plugin ya lo registra next/typescript
    // para estos archivos, así que solo sobreescribimos las reglas.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      // ignoreRestSiblings: permite el patrón de "quitar campos" con rest
      // (const { a, b, ...resto } = obj) sin marcar a/b como sin usar.
      // argsIgnorePattern: parámetros que empiezan por _ se ignoran a propósito.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
