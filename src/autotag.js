const https = require("https");
const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const natural = require("natural");
const { listTags } = require("./tags");

/**
 * Makes an HTTP request to OpenRouter API
 * @param {object} config - Configuration object
 * @param {object} requestBody - Request body for the API
 * @returns {Promise<object>} API response
 */
function makeOpenRouterRequest(config, requestBody) {
  return new Promise((resolve, reject) => {
    const apiUrl = new URL(
      "/api/v1/chat/completions",
      config.openrouter_endpoint || "https://openrouter.ai/api/v1"
    );
    const protocol = apiUrl.protocol === "https:" ? https : http;

    const body = JSON.stringify(requestBody);

    const options = {
      method: "POST",
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      path: apiUrl.pathname,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: `Bearer ${config.openrouter_api_key}`,
        "HTTP-Referer": "https://github.com/Nyokinokonoko/papra-ingest-tool",
        "X-Title": "Papra Ingest Tool",
      },
    };

    const req = protocol.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (error) {
            reject(
              new Error(`Failed to parse OpenRouter response: ${error.message}`)
            );
          }
        } else {
          reject(
            new Error(
              `OpenRouter API request failed with status ${res.statusCode}: ${data}`
            )
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

/**
 * Extracts text and metadata from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<object>} Extracted data {text, metadata, pages}
 */
async function extractPdfText(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  const result = {
    text: data.text || "",
    numPages: data.numpages || 0,
    info: data.info || {},
    metadata: data.metadata || {},
  };

  // Log extraction results
  console.log(
    `    PDF extracted: ${result.text.length} chars, ${result.numPages} pages`
  );

  return result;
}

/**
 * Extracts potential headings from text
 * @param {string} text - Full text content
 * @returns {string[]} Array of headings
 */
function extractHeadings(text) {
  const lines = text.split("\n").map((line) => line.trim());
  const headings = [];

  for (const line of lines) {
    if (!line || line.length < 3 || line.length > 100) continue;

    // All caps (at least 3 words)
    if (line === line.toUpperCase() && line.split(/\s+/).length >= 2) {
      headings.push(line);
    }
    // Title Case (most words capitalized)
    else if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(line)) {
      headings.push(line);
    }
    // Numbered headings
    else if (/^(\d+\.|\d+\)|\([a-z]\)|\([0-9]\))/.test(line)) {
      headings.push(line);
    }

    if (headings.length >= 10) break;
  }

  return headings.slice(0, 10);
}

/**
 * Extracts key entities (dates, amounts, emails) from text
 * @param {string} text - Full text content
 * @returns {string[]} Array of entities
 */
function extractEntities(text) {
  const entities = [];

  // Dates (various formats)
  const datePattern =
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}|\w+ \d{1,2},? \d{4})\b/g;
  const dates = text.match(datePattern);
  if (dates) entities.push(...dates.slice(0, 5));

  // Currency amounts
  const amountPattern = /[\$€£¥]\s?\d{1,3}(,\d{3})*(\.\d{2})?/g;
  const amounts = text.match(amountPattern);
  if (amounts) entities.push(...amounts.slice(0, 5));

  // Email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailPattern);
  if (emails) entities.push(...emails.slice(0, 3));

  // IDs (invoice numbers, order numbers, etc)
  const idPattern = /\b(INV|ORDER|REF|NO)[:\s#-]*[A-Z0-9-]{5,}\b/gi;
  const ids = text.match(idPattern);
  if (ids) entities.push(...ids.slice(0, 3));

  return entities.slice(0, 15);
}

/**
 * Extracts top keywords using TF-IDF
 * @param {string} text - Full text content
 * @returns {string[]} Array of keywords
 */
function extractKeywords(text) {
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();

  // Add the document
  tfidf.addDocument(text.toLowerCase());

  // Get terms with scores
  const terms = [];
  tfidf.listTerms(0).forEach((item) => {
    // Filter out very short words and common words
    if (
      item.term.length > 3 &&
      !["this", "that", "with", "from", "have", "been", "will"].includes(
        item.term
      )
    ) {
      terms.push(item.term);
    }
  });

  return terms.slice(0, 15);
}

/**
 * Detects document type from content
 * @param {string} text - Full text content
 * @param {string[]} headings - Extracted headings
 * @returns {string} Detected document type
 */
function detectDocumentType(text, headings) {
  const lowerText = text.toLowerCase();
  const allText = (lowerText + " " + headings.join(" ").toLowerCase()).slice(
    0,
    2000
  );

  // Check for various document types
  if (
    /invoice|bill|payment|amount due/i.test(allText) &&
    /\$|€|£|total/i.test(allText)
  ) {
    return "invoice";
  }
  if (/contract|agreement|terms|parties/i.test(allText)) {
    return "contract";
  }
  if (/resume|curriculum vitae|cv|experience|education/i.test(allText)) {
    return "resume";
  }
  if (/report|analysis|summary|findings|conclusion/i.test(allText)) {
    return "report";
  }
  if (/proposal|recommendation|objective/i.test(allText)) {
    return "proposal";
  }
  if (/statement|account|balance/i.test(allText)) {
    return "statement";
  }
  if (/receipt|purchase|transaction/i.test(allText)) {
    return "receipt";
  }

  return "unknown";
}

/**
 * Builds a compact document summary
 * @param {object} pdfData - Extracted PDF data
 * @param {string} fileName - Name of the file
 * @returns {string} Compact summary (≤2000 chars)
 */
function buildDocumentSummary(pdfData, fileName) {
  const { text, info } = pdfData;

  // Handle empty or minimal text
  if (!text || text.trim().length < 50) {
    console.warn(
      `    ⚠ Warning: PDF has minimal/no text (${text.length} chars). This may be a scanned document.`
    );
    // Return minimal summary with just filename
    return `Title: ${fileName.replace(
      /\.pdf$/i,
      ""
    )}\nType: unknown\nNote: Document appears to be empty or scanned (no extractable text)`;
  }

  // Extract components
  const title = info.Title || fileName.replace(/\.pdf$/i, "");
  const headings = extractHeadings(text);
  const entities = extractEntities(text);
  const keywords = extractKeywords(text);
  const docType = detectDocumentType(text, headings);

  // Split text into pages (rough estimate)
  const textLength = text.length;
  const charsPerPage = textLength / (pdfData.numPages || 1);

  // Extract first page content
  const firstPageText = text.slice(0, Math.min(charsPerPage * 1.5, 1000));
  const firstPageExcerpt = firstPageText
    .split(/[.!?]\s+/)
    .slice(0, 5)
    .join(". ")
    .slice(0, 500);

  // Extract last page content
  const lastPageStart = Math.max(0, textLength - charsPerPage * 1.5);
  const lastPageText = text.slice(lastPageStart);
  const lastPageExcerpt = lastPageText
    .split(/[.!?]\s+/)
    .slice(-5)
    .join(". ")
    .slice(0, 300);

  // Build summary
  let summary = `Title: ${title}\n`;
  summary += `Type: ${docType}\n`;

  if (headings.length > 0) {
    summary += `Headings: ${headings.slice(0, 8).join(" | ")}\n`;
  }

  if (entities.length > 0) {
    summary += `Key-Entities: ${entities.slice(0, 10).join(", ")}\n`;
  }

  if (keywords.length > 0) {
    summary += `Keywords: ${keywords.slice(0, 12).join(", ")}\n`;
  }

  if (firstPageExcerpt.trim()) {
    summary += `Excerpt (first): ${firstPageExcerpt.trim()}\n`;
  }

  if (lastPageExcerpt.trim() && lastPageExcerpt !== firstPageExcerpt) {
    summary += `Excerpt (last): ${lastPageExcerpt.trim()}\n`;
  }

  // Ensure we don't exceed 2000 chars
  const finalSummary = summary.slice(0, 2000);
  console.log(`    Summary generated: ${finalSummary.length} chars`);

  return finalSummary;
}

/**
 * Validates and normalizes tags
 * @param {any} rawTags - Raw tags from LLM
 * @returns {string[]} Validated and normalized tags
 */
function validateAndNormalizeTags(rawTags) {
  let tags = rawTags;

  // Handle {tags: [...]} format
  if (!Array.isArray(tags) && typeof tags === "object" && tags.tags) {
    tags = tags.tags;
  }

  // Ensure it's an array
  if (!Array.isArray(tags)) {
    return [];
  }

  // Clean and normalize
  const cleaned = tags
    .filter((tag) => typeof tag === "string" && tag.trim())
    .map((tag) => tag.toLowerCase().trim())
    .filter((tag) => {
      const words = tag.split(/\s+/);
      return words.length >= 1 && words.length <= 3;
    })
    .slice(0, 5);

  // Deduplicate
  return [...new Set(cleaned)];
}

/**
 * Generates tags for a document using OpenRouter LLM
 * @param {string} filePath - Full path to the PDF file
 * @param {object} config - Configuration object
 * @returns {Promise<string[]>} Array of generated tag names
 */
async function generateTagsForDocument(filePath, config) {
  // Validate OpenRouter configuration
  if (!config.openrouter_api_key) {
    throw new Error(
      "OpenRouter API key is not configured. Run with --setup to configure."
    );
  }

  const fileName = path.basename(filePath);

  // Extract PDF text and build summary
  let summary;
  try {
    console.log(`  → Extracting PDF text...`);
    const pdfData = await extractPdfText(filePath);
    summary = buildDocumentSummary(pdfData, fileName);

    if (!summary || summary.trim().length === 0) {
      throw new Error("Summary generation produced no content");
    }
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error.message}`);
  }

  // Get existing tags to prioritize them
  let existingTags = [];
  try {
    const tags = await listTags(config);
    existingTags = tags.map((tag) => tag.name);
  } catch (error) {
    console.warn(
      `  ⚠ Warning: Could not fetch existing tags: ${error.message}`
    );
  }

  // Build the prompt
  const existingTagsList =
    existingTags.length > 0
      ? `\n\nExisting tags in the system:\n${existingTags.join(", ")}`
      : "";

  const prompt = `You are a document tagging assistant. Analyze the document summary and generate relevant tags.

GUIDELINES:
1. PRIORITIZE using existing tags when applicable
2. Avoid overly specific tags
3. Focus on general categories, topics, document types, or themes
4. Keep tags concise (1–3 words)
5. Return 2–5 tags maximum
6. Return ONLY a JSON array of tag names, nothing else
7. Do NOT include any explanations or additional text
8. Start with uppercase letters for each word in tags
${existingTagsList}

DOCUMENT SUMMARY
----------------
${summary}

Return ONLY a JSON array of 2–5 tag names (lowercase, 1–3 words). Example: ["finance", "invoice", "2024"]`;

  const requestBody = {
    model: config.openrouter_model_name || "openai/gpt-5-nano",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0,
    max_tokens: 5000,
  };

  try {
    console.log(`    Sending to LLM...`);
    const response = await makeOpenRouterRequest(config, requestBody);

    // Log raw response for debugging
    console.log(
      `    LLM response received:`,
      JSON.stringify(response, null, 2).slice(0, 500)
    );

    if (!response) {
      throw new Error("No response from OpenRouter API");
    }

    if (!response.choices || !response.choices[0]) {
      throw new Error(
        `Invalid response structure: ${JSON.stringify(response)}`
      );
    }

    if (!response.choices[0].message) {
      throw new Error(
        `No message in response: ${JSON.stringify(response.choices[0])}`
      );
    }

    let content = response.choices[0].message.content;

    // For reasoning models (like gpt-5-nano), check the reasoning field if content is empty
    if (!content || content.trim().length === 0) {
      console.log(`    ⚠ Content field is empty, checking reasoning field...`);

      if (response.choices[0].message.reasoning) {
        const reasoning = response.choices[0].message.reasoning;
        console.log(`    Found reasoning field, extracting tags from it...`);

        // Try to extract JSON array from reasoning
        const match = reasoning.match(/\[.*\]/s);
        if (match) {
          content = match[0];
          console.log(`    Extracted from reasoning: ${content}`);
        } else {
          throw new Error(
            `No content in response and no JSON array found in reasoning field. Reasoning: ${reasoning.slice(
              0,
              300
            )}`
          );
        }
      } else {
        throw new Error(
          `Empty content in LLM response and no reasoning field. Full response: ${JSON.stringify(
            response
          )}`
        );
      }
    }

    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      throw new Error("LLM returned empty content after trimming");
    }

    console.log(`    LLM content: ${trimmedContent.slice(0, 200)}...`);

    // Try to parse the JSON response
    let tags;
    try {
      // Remove markdown code blocks if present
      const cleanContent = trimmedContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      if (!cleanContent) {
        throw new Error("Content is empty after cleaning");
      }

      tags = JSON.parse(cleanContent);
      console.log(`    Parsed tags:`, tags);
    } catch (parseError) {
      // If JSON parsing fails, try to extract array from the response
      console.log(`    JSON parse failed, trying to extract array...`);
      const match = trimmedContent.match(/\[.*\]/s);
      if (match) {
        try {
          tags = JSON.parse(match[0]);
          console.log(`    Extracted tags from array:`, tags);
        } catch (extractError) {
          throw new Error(`Failed to parse extracted array: ${match[0]}`);
        }
      } else {
        throw new Error(
          `Failed to parse tags from LLM response: ${trimmedContent}`
        );
      }
    }

    // Validate and normalize
    const validatedTags = validateAndNormalizeTags(tags);

    if (validatedTags.length === 0) {
      throw new Error("No valid tags generated by LLM");
    }

    return validatedTags;
  } catch (error) {
    throw new Error(`Failed to generate tags: ${error.message}`);
  }
}

/**
 * Checks if autotag feature is available based on configuration
 * @param {object} config - Configuration object
 * @returns {boolean} True if autotag is available
 */
function isAutotagAvailable(config) {
  return !!(config.openrouter_api_key && config.openrouter_api_key.trim());
}

module.exports = {
  generateTagsForDocument,
  isAutotagAvailable,
};
