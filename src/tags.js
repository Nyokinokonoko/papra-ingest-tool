const FormData = require("form-data");
const https = require("https");
const http = require("http");

/**
 * Makes an HTTP request
 * @param {object} options - Request options
 * @param {string|FormData} [body] - Request body
 * @returns {Promise<{statusCode: number, data: any}>}
 */
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === "https:" ? https : http;

    const req = protocol.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsedData });
          } catch (error) {
            resolve({ statusCode: res.statusCode, data: data });
          }
        } else {
          reject(
            new Error(`Request failed with status ${res.statusCode}: ${data}`)
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body instanceof FormData) {
      body.pipe(req);
    } else if (body) {
      req.write(body);
      req.end();
    } else {
      req.end();
    }
  });
}

/**
 * Lists all tags for an organization
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} Array of tag objects
 */
async function listTags(config) {
  const apiUrl = new URL(
    `/api/organizations/${config.papra_organization_id}/tags`,
    config.papra_url
  );

  const options = {
    method: "GET",
    protocol: apiUrl.protocol,
    hostname: apiUrl.hostname,
    port: apiUrl.port,
    path: apiUrl.pathname,
    headers: {
      Authorization: `Bearer ${config.papra_api_key}`,
    },
  };

  const result = await makeRequest(options);
  return result.data.tags || [];
}

/**
 * Creates a new tag
 * @param {string} tagName - Name of the tag to create
 * @param {object} config - Configuration object
 * @returns {Promise<object>} Created tag object
 */
async function createTag(tagName, config) {
  const body = JSON.stringify({
    name: tagName,
    color: "#000000",
  });

  const apiUrl = new URL(
    `/api/organizations/${config.papra_organization_id}/tags`,
    config.papra_url
  );

  const options = {
    method: "POST",
    protocol: apiUrl.protocol,
    hostname: apiUrl.hostname,
    port: apiUrl.port,
    path: apiUrl.pathname,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Authorization: `Bearer ${config.papra_api_key}`,
    },
  };

  const result = await makeRequest(options, body);
  return result.data.tag;
}

/**
 * Attaches a tag to a document
 * @param {string} documentId - Document ID
 * @param {string} tagId - Tag ID
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
async function attachTagToDocument(documentId, tagId, config) {
  const body = JSON.stringify({
    tagId: tagId,
  });

  const apiUrl = new URL(
    `/api/organizations/${config.papra_organization_id}/documents/${documentId}/tags`,
    config.papra_url
  );

  const options = {
    method: "POST",
    protocol: apiUrl.protocol,
    hostname: apiUrl.hostname,
    port: apiUrl.port,
    path: apiUrl.pathname,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Authorization: `Bearer ${config.papra_api_key}`,
    },
  };

  await makeRequest(options, body);
}

/**
 * Ensures tags exist, creating them if necessary
 * @param {string[]} tagNames - Array of tag names
 * @param {object} config - Configuration object
 * @returns {Promise<Array>} Array of tag objects with IDs
 */
async function ensureTagsExist(tagNames, config) {
  if (!tagNames || tagNames.length === 0) {
    return [];
  }

  // Fetch existing tags
  const existingTags = await listTags(config);

  // Create a map of existing tag names to tag objects (case-insensitive)
  const existingTagMap = new Map();
  existingTags.forEach((tag) => {
    existingTagMap.set(tag.name.toLowerCase(), tag);
  });

  // Determine which tags need to be created
  const tagsToCreate = tagNames.filter(
    (name) => !existingTagMap.has(name.toLowerCase())
  );

  // Create missing tags
  const createdTags = [];
  for (const tagName of tagsToCreate) {
    const newTag = await createTag(tagName, config);
    createdTags.push(newTag);
    existingTagMap.set(tagName.toLowerCase(), newTag);
  }

  // Return all tag objects (existing + newly created)
  return tagNames.map((name) => existingTagMap.get(name.toLowerCase()));
}

/**
 * Attaches multiple tags to a document
 * @param {string} documentId - Document ID
 * @param {string[]} tagNames - Array of tag names
 * @param {object} config - Configuration object
 * @returns {Promise<void>}
 */
async function attachTagsToDocument(documentId, tagNames, config) {
  if (!tagNames || tagNames.length === 0) {
    return;
  }

  const tags = await ensureTagsExist(tagNames, config);

  for (const tag of tags) {
    await attachTagToDocument(documentId, tag.id, config);
  }
}

module.exports = {
  listTags,
  createTag,
  attachTagToDocument,
  ensureTagsExist,
  attachTagsToDocument,
};
