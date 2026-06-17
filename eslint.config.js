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
      // Reglas del React Compiler (eslint-plugin-react-hooks). Todos los casos
      // del código se han resuelto: los que eran mejora real se refactorizaron
      // (estado derivado de props, mirror de ref en efecto, mutaciones, código
      // muerto) y los pocos patrones intencionados e irreducibles (carga de
      // datos al montar, reset de formulario, guards de hidratación SSR,
      // reacciones a auth) llevan un eslint-disable puntual y justificado en su
      // sitio. Se mantienen en ERROR para bloquear nuevas infracciones.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
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
