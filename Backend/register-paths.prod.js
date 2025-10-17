const path = require("path");
const Module = require("module");

// Register path aliases
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  // Map path aliases to actual paths
  const pathMappings = {
    "@/*": "./src/*",
    "@/config/*": "./src/config/*",
    "@/controllers/*": "./src/controllers/*",
    "@/middleware/*": "./src/middleware/*",
    "@/models/*": "./src/models/*",
    "@/routes/*": "./src/routes/*",
    "@/services/*": "./src/services/*",
    "@/utils/*": "./src/utils/*",
    "@/types/*": "./src/types/*"
  };

  // Check if the module ID matches any of our path mappings
  for (const [alias, actualPath] of Object.entries(pathMappings)) {
    if (id.startsWith(alias.replace("*", ""))) {
      const relativePath = id.replace(alias.replace("*", ""), "");
      const resolvedPath = actualPath.replace("*", relativePath);
      return originalRequire.call(this, path.resolve(__dirname, resolvedPath));
    }
  }

  // For all other modules, use the original require
  return originalRequire.call(this, id);
};

console.log("TypeScript path mappings registered for production");