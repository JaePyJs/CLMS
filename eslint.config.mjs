import backendConfig from "./Backend/eslint.config.mjs";
import frontendConfig from "./Frontend/eslint.config.mjs";

/**
 * Prefixes 'files' and 'ignores' patterns with a directory name.
 * @param {Array} configArray - The ESLint flat config array.
 * @param {string} directory - The directory to prefix (e.g., 'Backend').
 * @returns {Array} - The modified config array.
 */
function scopeConfig(configArray, directory) {
  return configArray.map((config) => {
    const newConfig = { ...config };

    if (newConfig.files) {
      newConfig.files = newConfig.files.map((pattern) =>
        pattern.startsWith("!")
          ? `!${directory}/${pattern.slice(1)}`
          : `${directory}/${pattern}`
      );
    }

    if (newConfig.ignores) {
      newConfig.ignores = newConfig.ignores.map((pattern) =>
        pattern.startsWith("!")
          ? `!${directory}/${pattern.slice(1)}`
          : `${directory}/${pattern}`
      );
    }

    // If no files are specified, restrict this config to the directory
    // BUT only if it's not a global ignore config (which usually has only 'ignores')
    if (!newConfig.files && !newConfig.ignores) {
      // This is risky for configs like js.configs.recommended which apply globally.
      // We should force them to apply only to the directory.
      newConfig.files = [`${directory}/**/*`];
    } else if (!newConfig.files && newConfig.ignores) {
      // If it only has ignores, it might be a global ignore.
      // We should probably leave it or scope the ignores?
      // Scoping ignores is done above.
    }

    return newConfig;
  });
}

export default [
  // Global ignores for root
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      ".git/**",
      ".vscode/**",
      ".idea/**",
    ],
  },
  ...scopeConfig(backendConfig, "Backend"),
  ...scopeConfig(frontendConfig, "Frontend"),
];
