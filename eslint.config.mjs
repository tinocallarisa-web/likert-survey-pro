import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
    powerbiVisualsConfigs.configs.recommended,
    {
        // Scripts locales de empaquetado: no viajan dentro del .pbiviz, así que las reglas
        // de seguridad del visual no les aplican.
        ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**", "build-test.js", "scripts/**"],
    },
];
