#!/usr/bin/env node

const { runSetup, ensureConfig } = require("./config");
const { validateOcrLanguages, uploadPdfs } = require("./upload");
const { input } = require("@inquirer/prompts");

/**
 * Parses command line arguments
 * @returns {object} Parsed arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const parsed = {
    setup: false,
    src: null,
    lang: [],
    tag: [],
    autotag: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--setup") {
      parsed.setup = true;
    } else if (arg === "--src" && i + 1 < args.length) {
      parsed.src = args[i + 1];
      i++; // Skip next arg as it's the value
    } else if (arg === "--lang" && i + 1 < args.length) {
      // Split by comma to support multiple languages
      const langValue = args[i + 1];
      parsed.lang = langValue.split(",").map((lang) => lang.trim());
      i++; // Skip next arg as it's the value
    } else if (arg === "--tag" && i + 1 < args.length) {
      // Split by comma to support multiple tags
      const tagValue = args[i + 1];
      parsed.tag = tagValue.split(",").map((tag) => tag.trim());
      i++; // Skip next arg as it's the value
    } else if (arg === "--autotag") {
      parsed.autotag = true;
    } else if (arg === "--verbose") {
      parsed.verbose = true;
    }
  }

  return parsed;
}

async function main() {
  // Parse command line arguments
  const args = parseArguments();

  // If --setup is provided, ignore src and lang, just run setup
  if (args.setup) {
    await runSetup();
    return;
  }

  // Ensure configuration is valid before proceeding
  const config = await ensureConfig();

  // Validate OCR languages if provided
  if (args.lang.length > 0) {
    const validation = validateOcrLanguages(args.lang);
    if (!validation.valid) {
      console.error(
        `\n✗ Invalid OCR language(s): ${validation.invalidLanguages.join(", ")}`
      );
      console.error(
        "Please use valid language codes (e.g., eng, jpn, fra, etc.)\n"
      );
      process.exit(1);
    }
  }

  // Get source path
  let sourcePath = args.src;

  if (!sourcePath) {
    // Prompt user for path
    sourcePath = await input({
      message: "Enter path to PDF file or directory:",
      validate: (value) => {
        if (!value || value.trim() === "") {
          return "Path is required";
        }
        return true;
      },
    });
  }

  // Sanitize the path: remove quotes and extra whitespace
  sourcePath = sourcePath
    .trim()
    // Remove surrounding single quotes
    .replace(/^'|'$/g, "")
    // Remove surrounding double quotes
    .replace(/^"|"$/g, "");

  // Upload PDFs
  await uploadPdfs(
    sourcePath,
    config,
    args.lang,
    args.tag,
    args.autotag,
    args.verbose
  );
}

// Run the main function
main().catch((error) => {
  console.error("\n✗ Fatal error:", error.message);
  process.exit(1);
});
