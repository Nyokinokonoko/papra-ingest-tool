#!/usr/bin/env node

const { runSetup, ensureConfig } = require("./config");

async function main() {
  // Check if --setup flag is provided
  const args = process.argv.slice(2);
  const isSetupMode = args.includes("--setup");

  if (isSetupMode) {
    // Run setup wizard
    await runSetup();
    return;
  }

  // Ensure configuration is valid before proceeding
  const config = await ensureConfig();

  // Check if AI tagging is available
  const aiTaggingAvailable =
    config.openrouter_endpoint &&
    config.openrouter_api_key &&
    config.openrouter_model_name;

  // Configuration is now loaded and validated
  console.log("Configuration loaded successfully!");
  console.log(`Papra URL: ${config.papra_url}`);

  if (aiTaggingAvailable) {
    console.log(`AI Tagging: Available (${config.openrouter_model_name})`);
  } else {
    console.log("AI Tagging: Unavailable (missing OpenRouter configuration)");
    console.log("Run 'papra-ingest-tool --setup' to configure AI tagging.\n");
  }
}

// Run the main function
main().catch((error) => {
  console.error("\n✗ Fatal error:", error.message);
  process.exit(1);
});
