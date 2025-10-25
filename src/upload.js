const fs = require("fs").promises;
const path = require("path");
const FormData = require("form-data");
const https = require("https");
const http = require("http");
const { ensureTagsExist, attachTagToDocument } = require("./tags");
const { generateTagsForDocument, isAutotagAvailable } = require("./autotag");

// Supported OCR languages
const SUPPORTED_OCR_LANGUAGES = [
  "afr",
  "amh",
  "ara",
  "asm",
  "aze",
  "aze_cyrl",
  "bel",
  "ben",
  "bod",
  "bos",
  "bul",
  "cat",
  "ceb",
  "ces",
  "chi_sim",
  "chi_tra",
  "chr",
  "cym",
  "dan",
  "deu",
  "dzo",
  "ell",
  "eng",
  "enm",
  "epo",
  "est",
  "eus",
  "fas",
  "fin",
  "fra",
  "frk",
  "frm",
  "gle",
  "glg",
  "grc",
  "guj",
  "hat",
  "heb",
  "hin",
  "hrv",
  "hun",
  "iku",
  "ind",
  "isl",
  "ita",
  "ita_old",
  "jav",
  "jpn",
  "kan",
  "kat",
  "kat_old",
  "kaz",
  "khm",
  "kir",
  "kor",
  "kur",
  "lao",
  "lat",
  "lav",
  "lit",
  "mal",
  "mar",
  "mkd",
  "mlt",
  "msa",
  "mya",
  "nep",
  "nld",
  "nor",
  "ori",
  "pan",
  "pol",
  "por",
  "pus",
  "ron",
  "rus",
  "san",
  "sin",
  "slk",
  "slv",
  "spa",
  "spa_old",
  "sqi",
  "srp",
  "srp_latn",
  "swa",
  "swe",
  "syr",
  "tam",
  "tel",
  "tgk",
  "tgl",
  "tha",
  "tir",
  "tur",
  "uig",
  "ukr",
  "urd",
  "uzb",
  "uzb_cyrl",
  "vie",
  "yid",
];

/**
 * Validates OCR languages against supported list
 * @param {string[]} languages - Array of language codes
 * @returns {{valid: boolean, invalidLanguages: string[]}}
 */
function validateOcrLanguages(languages) {
  if (!Array.isArray(languages)) {
    return { valid: false, invalidLanguages: [] };
  }

  const invalidLanguages = languages.filter(
    (lang) => !SUPPORTED_OCR_LANGUAGES.includes(lang)
  );

  return {
    valid: invalidLanguages.length === 0,
    invalidLanguages,
  };
}

/**
 * Recursively finds all PDF files in a directory
 * @param {string} dirPath - Directory path to search
 * @returns {Promise<string[]>} Array of PDF file paths
 */
async function findPdfFiles(dirPath) {
  const pdfFiles = [];

  async function traverse(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (
        entry.isFile() &&
        path.extname(entry.name).toLowerCase() === ".pdf"
      ) {
        pdfFiles.push(fullPath);
      }
    }
  }

  await traverse(dirPath);
  return pdfFiles;
}

/**
 * Checks if a file is a PDF
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function isPdfFile(filePath) {
  return path.extname(filePath).toLowerCase() === ".pdf";
}

/**
 * Uploads a single PDF file to Papra API
 * @param {string} filePath - Path to PDF file
 * @param {object} config - Configuration object
 * @param {string[]} ocrLanguages - Optional OCR languages
 * @param {Array} tagObjects - Optional array of tag objects with IDs
 * @returns {Promise<object>} Upload result
 */
function uploadPdfToPapra(
  filePath,
  config,
  ocrLanguages = [],
  tagObjects = []
) {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    // Add file to form
    form.append("file", require("fs").createReadStream(filePath));

    // Add OCR languages if provided
    if (ocrLanguages && ocrLanguages.length > 0) {
      form.append("ocrLanguages", JSON.stringify(ocrLanguages));
    }

    // Parse URL
    const apiUrl = new URL(
      `/api/organizations/${config.papra_organization_id}/documents`,
      config.papra_url
    );

    const protocol = apiUrl.protocol === "https:" ? https : http;

    const options = {
      method: "POST",
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      path: apiUrl.pathname,
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${config.papra_api_key}`,
      },
    };

    const req = protocol.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const response = JSON.parse(data);
            const result = {
              success: true,
              document: response.document,
              statusCode: res.statusCode,
            };

            // Attach tags if provided
            if (
              tagObjects &&
              tagObjects.length > 0 &&
              response.document &&
              response.document.id
            ) {
              let newlyAttached = 0;
              let alreadyAttached = 0;
              const tagErrors = [];

              for (const tag of tagObjects) {
                try {
                  const attachResult = await attachTagToDocument(
                    response.document.id,
                    tag.id,
                    config
                  );

                  if (attachResult.alreadyAttached) {
                    alreadyAttached++;
                  } else {
                    newlyAttached++;
                  }
                } catch (tagError) {
                  tagErrors.push(`${tag.name}: ${tagError.message}`);
                }
              }

              result.tagsAttached = newlyAttached;
              result.tagsAlreadyAttached = alreadyAttached;

              if (tagErrors.length > 0) {
                result.tagErrors = tagErrors;
              }
            }

            resolve(result);
          } catch (error) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              rawResponse: data,
            });
          }
        } else {
          reject(
            new Error(`Upload failed with status ${res.statusCode}: ${data}`)
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    form.pipe(req);
  });
}

/**
 * Main upload function
 * @param {string} sourcePath - Path to PDF file or directory
 * @param {object} config - Configuration object
 * @param {string[]} ocrLanguages - Optional OCR languages
 * @param {string[]} tags - Optional array of tag names
 * @param {boolean} autotag - Whether to use AI auto-tagging
 * @param {boolean} verbose - Whether to show verbose logging
 */
async function uploadPdfs(
  sourcePath,
  config,
  ocrLanguages = [],
  tags = [],
  autotag = false,
  verbose = false
) {
  try {
    // Check if path exists
    const stats = await fs.stat(sourcePath);
    let pdfFiles = [];

    if (stats.isDirectory()) {
      console.log(`\nSearching for PDF files in: ${sourcePath}`);
      pdfFiles = await findPdfFiles(sourcePath);

      if (pdfFiles.length === 0) {
        console.error("\n✗ No PDF files found in the specified directory.");
        process.exit(1);
      }

      console.log(`Found ${pdfFiles.length} PDF file(s)\n`);
    } else if (stats.isFile()) {
      if (!isPdfFile(sourcePath)) {
        console.error("\n✗ The specified file is not a PDF.");
        process.exit(1);
      }
      pdfFiles = [sourcePath];
      console.log(`\nProcessing single PDF file: ${sourcePath}\n`);
    } else {
      console.error(
        "\n✗ The specified path is neither a file nor a directory."
      );
      process.exit(1);
    }

    // Display OCR language info if provided
    if (ocrLanguages && ocrLanguages.length > 0) {
      console.log(`OCR Languages: ${ocrLanguages.join(", ")}\n`);
    }

    // Check autotag availability
    if (autotag && !isAutotagAvailable(config)) {
      console.error(
        "\n✗ Autotag feature requires OpenRouter API key to be configured."
      );
      console.error("Run with --setup to configure OpenRouter settings.\n");
      process.exit(1);
    }

    // Display tagging mode
    if (autotag && tags && tags.length > 0) {
      console.log(`Manual Tags: ${tags.join(", ")}`);
      console.log(`Autotag: Enabled (will generate tags for each document)\n`);
    } else if (autotag) {
      console.log(`Autotag: Enabled (will generate tags for each document)\n`);
    } else if (tags && tags.length > 0) {
      console.log(`Manual Tags: ${tags.join(", ")}\n`);
    }

    // For manual tags (non-autotag), prepare them once
    let manualTagObjects = [];
    if (tags && tags.length > 0 && !autotag) {
      try {
        manualTagObjects = await ensureTagsExist(tags, config);
        console.log(`  ✓ Tags ready (${manualTagObjects.length} tag(s))\n`);
      } catch (error) {
        console.error(`  ✗ Failed to prepare tags: ${error.message}\n`);
        process.exit(1);
      }
    }

    // Upload each PDF
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pdfFiles.length; i++) {
      const filePath = pdfFiles[i];
      const fileName = path.basename(filePath);

      console.log(`[${i + 1}/${pdfFiles.length}] Uploading: ${fileName}`);

      try {
        // Determine tags for this specific document
        let documentTagObjects = [];

        // If autotag is enabled, generate tags for this document
        if (autotag) {
          try {
            console.log(`  → Generating tags...`);
            const autoGeneratedTags = await generateTagsForDocument(
              filePath,
              config,
              verbose
            );
            console.log(`    Generated: ${autoGeneratedTags.join(", ")}`);

            // Combine auto-generated tags with manual tags
            const allTags = [...new Set([...tags, ...autoGeneratedTags])];

            // Ensure all tags exist for this document
            documentTagObjects = await ensureTagsExist(allTags, config);
          } catch (autotagError) {
            console.warn(`    ⚠ Autotag failed: ${autotagError.message}`);
            // Fall back to manual tags only if autotag fails
            if (tags && tags.length > 0) {
              documentTagObjects = await ensureTagsExist(tags, config);
            }
          }
        } else {
          // Use pre-prepared manual tags
          documentTagObjects = manualTagObjects;
        }

        const result = await uploadPdfToPapra(
          filePath,
          config,
          ocrLanguages,
          documentTagObjects
        );
        console.log(`  ✓ Uploaded successfully`);
        if (result.document && result.document.id) {
          console.log(`    Document ID: ${result.document.id}`);
        }
        if (result.tagsAttached || result.tagsAlreadyAttached) {
          const tagParts = [];
          if (result.tagsAttached > 0) {
            tagParts.push(`${result.tagsAttached} newly attached`);
          }
          if (result.tagsAlreadyAttached > 0) {
            tagParts.push(`${result.tagsAlreadyAttached} already attached`);
          }
          console.log(`    Tags: ${tagParts.join(", ")}`);
        }
        if (result.tagErrors && result.tagErrors.length > 0) {
          console.log(`    ⚠ Tag errors: ${result.tagErrors.join("; ")}`);
        }
        successCount++;
      } catch (error) {
        console.error(`  ✗ Upload failed: ${error.message}`);
        failCount++;
      }
    }

    // Summary
    console.log(`\n=== Upload Summary ===`);
    console.log(`Total files: ${pdfFiles.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`\n✗ Path does not exist: ${sourcePath}`);
    } else {
      console.error(`\n✗ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

module.exports = {
  SUPPORTED_OCR_LANGUAGES,
  validateOcrLanguages,
  uploadPdfs,
};
