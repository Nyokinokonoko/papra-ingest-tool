const { input } = require("@inquirer/prompts");

// Dynamic import for ESM module
let Conf;
async function loadConf() {
  if (!Conf) {
    const module = await import("conf");
    Conf = module.default;
  }
  return Conf;
}

// Config instance (initialized on first use)
let config;

async function getConfig() {
  if (!config) {
    const ConfClass = await loadConf();
    config = new ConfClass({
      projectName: "papra-ingest-tool",
      schema: {
        papra_url: {
          type: "string",
        },
        papra_api_key: {
          type: "string",
        },
        openrouter_endpoint: {
          type: "string",
          default: "https://openrouter.ai/api/v1",
        },
        openrouter_api_key: {
          type: "string",
        },
        openrouter_model_name: {
          type: "string",
          default: "openai/gpt-5-nano",
        },
      },
    });
  }
  return config;
}

const REQUIRED_FIELDS = ["papra_url", "papra_api_key"];

/**
 * Normalizes a URL by adding https:// if no protocol and removing trailing slashes
 */
function normalizeUrl(url) {
  if (!url || typeof url !== "string") {
    return url;
  }

  let normalized = url.trim();

  // Add https:// if no protocol is specified
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, "");

  return normalized;
}

/**
 * Validates a URL to ensure it's not empty
 */
function validateUrl(url, fieldName) {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return `${fieldName} is required`;
  }
  return true;
}

/**
 * Validates that a field is not empty
 */
function validateNotEmpty(value, fieldName) {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return `${fieldName} is required`;
  }
  return true;
}

/**
 * Checks if the configuration is valid
 */
async function isConfigValid() {
  const conf = await getConfig();
  for (const field of REQUIRED_FIELDS) {
    if (!conf.has(field) || !conf.get(field)) {
      return false;
    }
  }
  return true;
}

/**
 * Interactive setup to create/update configuration
 */
async function runSetup() {
  const conf = await getConfig();
  console.log("\n=== Papra Ingest Tool Configuration Setup ===\n");
  console.log(`Configuration will be saved to: ${conf.path}\n`);

  if (conf.size > 0) {
    console.log(
      "Existing configuration found. Press Enter to keep current values.\n"
    );
  }

  // Papra URL
  const papraUrl = await input({
    message: "Papra URL (will auto-add https:// if no protocol specified):",
    default: conf.get("papra_url") || "",
    validate: (value) => validateUrl(value, "Papra URL"),
  });
  conf.set("papra_url", normalizeUrl(papraUrl));

  // Papra API Key
  const papraApiKey = await input({
    message: "Papra API Key:",
    default: conf.get("papra_api_key") || "",
    validate: (value) => validateNotEmpty(value, "Papra API Key"),
  });
  conf.set("papra_api_key", papraApiKey);

  console.log("\nOptional: AI Tagging Configuration (leave blank to skip)\n");

  // OpenRouter Endpoint (Optional)
  const openrouterEndpoint = await input({
    message: "OpenRouter Endpoint (optional, for AI tagging):",
    default: conf.get("openrouter_endpoint") || "",
  });
  if (openrouterEndpoint.trim()) {
    conf.set("openrouter_endpoint", openrouterEndpoint);
  } else {
    conf.delete("openrouter_endpoint");
  }

  // OpenRouter API Key (Optional)
  const openrouterApiKey = await input({
    message: "OpenRouter API Key (optional, for AI tagging):",
    default: conf.get("openrouter_api_key") || "",
  });
  if (openrouterApiKey.trim()) {
    conf.set("openrouter_api_key", openrouterApiKey);
  } else {
    conf.delete("openrouter_api_key");
  }

  // OpenRouter Model Name (Optional)
  const openrouterModelName = await input({
    message: "OpenRouter Model Name (optional, for AI tagging):",
    default: conf.get("openrouter_model_name") || "",
  });
  if (openrouterModelName.trim()) {
    conf.set("openrouter_model_name", openrouterModelName);
  } else {
    conf.delete("openrouter_model_name");
  }

  console.log(`\n✓ Configuration saved successfully to ${conf.path}\n`);

  return {
    papra_url: conf.get("papra_url"),
    papra_api_key: conf.get("papra_api_key"),
    openrouter_endpoint: conf.get("openrouter_endpoint"),
    openrouter_api_key: conf.get("openrouter_api_key"),
    openrouter_model_name: conf.get("openrouter_model_name"),
  };
}

/**
 * Ensures valid configuration exists, running setup if needed
 */
async function ensureConfig() {
  if (!(await isConfigValid())) {
    console.error("\n✗ Configuration is invalid or missing.\n");
    console.log("Running setup wizard...\n");
    return await runSetup();
  }

  const conf = await getConfig();
  return {
    papra_url: conf.get("papra_url"),
    papra_api_key: conf.get("papra_api_key"),
    openrouter_endpoint: conf.get("openrouter_endpoint"),
    openrouter_api_key: conf.get("openrouter_api_key"),
    openrouter_model_name: conf.get("openrouter_model_name"),
  };
}

/**
 * Returns the config file path
 */
async function getConfigPath() {
  const conf = await getConfig();
  return conf.path;
}

module.exports = {
  runSetup,
  ensureConfig,
  getConfigPath,
};
