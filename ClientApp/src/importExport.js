import {
  createId,
  normalizeAuthType,
  normalizeFolder,
  parseHeaderRows,
  inferBodyMode,
  serializeKeyValueRows,
  savedRequestFromParts,
  hasAssertions,
  headerLinesFromHeaders,
} from "./utils.js";

// ── OpenAPI import ────────────────────────────────────────────────────────────

// Resolves a local JSON pointer ($ref) like "#/components/schemas/Foo" or the
// Swagger 2.0 "#/definitions/Foo" form against the root document.
function resolveRef(ref, root) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  const segments = ref.slice(2).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return null;
    current = current[segment];
  }
  return current ?? null;
}

function generateExampleFromSchema(schema, root, depth = 0, seenRefs = new Set()) {
  if (!schema || depth > 6) return null;
  if (schema.$ref) {
    if (seenRefs.has(schema.$ref)) return {}; // circular reference guard
    const resolved = resolveRef(schema.$ref, root);
    if (!resolved) return {};
    return generateExampleFromSchema(resolved, root, depth + 1, new Set([...seenRefs, schema.$ref]));
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  // Composition: merge allOf, pick the first oneOf/anyOf branch.
  if (Array.isArray(schema.allOf) && schema.allOf.length) {
    const merged = {};
    for (const sub of schema.allOf) {
      const part = generateExampleFromSchema(sub, root, depth + 1, seenRefs);
      if (part && typeof part === "object" && !Array.isArray(part)) Object.assign(merged, part);
    }
    return merged;
  }
  const branch = (Array.isArray(schema.oneOf) && schema.oneOf[0]) || (Array.isArray(schema.anyOf) && schema.anyOf[0]);
  if (branch) return generateExampleFromSchema(branch, root, depth + 1, seenRefs);
  // Treat a schema with properties but no explicit type as an object (common).
  if ((schema.type === "object" || (!schema.type && schema.properties))) {
    const result = {};
    for (const [key, prop] of Object.entries(schema.properties || {}))
      result[key] = generateExampleFromSchema(prop, root, depth + 1, seenRefs);
    return result;
  }
  switch (schema.type) {
    case "array":
      return [generateExampleFromSchema(schema.items, root, depth + 1, seenRefs)];
    case "string":
      return schema.enum?.[0] ?? (schema.format === "date-time" ? "2024-01-01T00:00:00Z" : schema.format === "date" ? "2024-01-01" : schema.format === "uuid" ? "00000000-0000-0000-0000-000000000000" : "string");
    case "integer":
    case "number":
      return schema.enum?.[0] ?? schema.minimum ?? 0;
    case "boolean":
      return false;
    default:
      return {};
  }
}

export function importOpenApi(parsed) {
  const isV3 = typeof parsed.openapi === "string" && parsed.openapi.startsWith("3");
  const isV2 = parsed.swagger === "2.0";
  if (!isV3 && !isV2) throw new Error("File must be an OpenAPI 3.x or Swagger 2.0 document.");

  let baseUrl = "";
  if (isV3) {
    const server = (parsed.servers || [])[0];
    baseUrl = (server?.url || "").replace(/\/$/, "");
  } else {
    const scheme = (parsed.schemes || ["https"])[0];
    const host = parsed.host || "";
    const basePath = (parsed.basePath || "").replace(/\/$/, "");
    if (host) baseUrl = `${scheme}://${host}${basePath}`;
  }

  const VERBS = ["get", "post", "put", "patch", "delete", "head", "options"];
  const imported = [];
  for (const [path, pathItem] of Object.entries(parsed.paths || {})) {
    for (const method of VERBS) {
      const op = pathItem[method];
      if (!op || typeof op !== "object") continue;
      const name = op.operationId || op.summary || `${method.toUpperCase()} ${path}`;
      const folder = ((op.tags || [])[0] || "").trim();
      const url = (baseUrl || "https://api.example.com") + path;
      const allParams = [...(pathItem.parameters || []), ...(op.parameters || [])];
      const queryRows = allParams.filter(p => p.in === "query").map(p => `${p.name}=${p.example ?? p.schema?.example ?? ""}`).join("\n");
      const headerLines = allParams.filter(p => p.in === "header" && p.name?.toLowerCase() !== "authorization").map(p => `${p.name}: ${p.example ?? p.schema?.example ?? ""}`).join("\n");
      let body = "", contentType = "application/json";
      if (isV3 && op.requestBody) {
        const jsonContent = op.requestBody.content?.["application/json"];
        if (jsonContent?.schema) { try { body = JSON.stringify(generateExampleFromSchema(jsonContent.schema, parsed), null, 2); } catch { body = ""; } }
      } else if (isV2) {
        const bodyParam = allParams.find(p => p.in === "body");
        if (bodyParam?.schema) { try { body = JSON.stringify(generateExampleFromSchema(bodyParam.schema, parsed), null, 2); } catch { body = ""; } }
        const formParams = allParams.filter(p => p.in === "formData");
        if (formParams.length && !body) { body = formParams.map(p => `${encodeURIComponent(p.name)}=`).join("&"); contentType = "application/x-www-form-urlencoded"; }
      }
      try {
        const item = savedRequestFromParts({ name, folder, method: method.toUpperCase(), url, headers: parseHeaderRows(headerLines).filter(r => r.name), contentType, body });
        if (queryRows) item.params = queryRows;
        imported.push(item);
      } catch { /* skip invalid */ }
    }
  }
  if (!imported.length) throw new Error("No API operations found in the OpenAPI/Swagger document.");
  return imported;
}

// ── Postman import/export ─────────────────────────────────────────────────────

export function postmanUrlToString(value) {
  if (typeof value === "string") return value;
  if (value?.raw) return value.raw;
  const protocol = value?.protocol ? `${value.protocol}://` : "";
  const host = Array.isArray(value?.host) ? value.host.join(".") : String(value?.host || "");
  const path = Array.isArray(value?.path) ? `/${value.path.join("/")}` : value?.path ? `/${value.path}` : "";
  const query = Array.isArray(value?.query) && value.query.length
    ? `?${value.query.filter(item => !item.disabled).map(item => `${encodeURIComponent(item.key || "")}=${encodeURIComponent(item.value || "")}`).join("&")}`
    : "";
  return `${protocol}${host}${path}${query}`;
}

export function postmanBodyToParts(body) {
  if (!body) return { bodyText: "", contentType: "application/json" };
  if (body.mode === "urlencoded" && Array.isArray(body.urlencoded)) {
    const parameters = new URLSearchParams();
    body.urlencoded.filter(item => !item.disabled).forEach(item => parameters.append(item.key || "", item.value || ""));
    return { bodyText: parameters.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  if (body.mode === "graphql" && body.graphql) {
    const query = body.graphql.query || "";
    let variables = {};
    const rawVars = body.graphql.variables;
    if (typeof rawVars === "string" && rawVars.trim()) { try { variables = JSON.parse(rawVars); } catch { variables = {}; } }
    else if (rawVars && typeof rawVars === "object") variables = rawVars;
    return { bodyText: JSON.stringify({ query, variables }), contentType: "application/json" };
  }
  if (body.mode === "raw") {
    const language = body.options?.raw?.language;
    const contentType = language === "text" ? "text/plain" : "application/json";
    return { bodyText: body.raw || "", contentType };
  }
  if (body.mode === "formdata" && Array.isArray(body.formdata)) {
    const parameters = new URLSearchParams();
    body.formdata.filter(item => !item.disabled && item.type !== "file").forEach(item => parameters.append(item.key || "", item.value || ""));
    return { bodyText: parameters.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  return { bodyText: "", contentType: "application/json" };
}

export function postmanAuthToParts(auth) {
  if (!auth || auth.type === "noauth") return { authType: "none", authToken: "", authKeyName: "", authKeyIn: "header" };
  if (auth.type === "bearer") {
    const token = auth.bearer?.find?.(item => item.key === "token")?.value || "";
    return { authType: "bearer", authToken: token, authKeyName: "", authKeyIn: "header" };
  }
  if (auth.type === "basic") {
    const username = auth.basic?.find?.(item => item.key === "username")?.value || "";
    const password = auth.basic?.find?.(item => item.key === "password")?.value || "";
    return { authType: "basic", authToken: username || password ? `${username}:${password}` : "", authKeyName: "", authKeyIn: "header" };
  }
  if (auth.type === "apikey") {
    const key = auth.apikey?.find?.(item => item.key === "key")?.value || "";
    const value = auth.apikey?.find?.(item => item.key === "value")?.value || "";
    const location = auth.apikey?.find?.(item => item.key === "in")?.value || "header";
    return { authType: key && value ? "apikey" : "none", authToken: value, authKeyName: key, authKeyIn: location === "query" ? "query" : "header" };
  }
  return { authType: "none", authToken: "", authKeyName: "", authKeyIn: "header" };
}

export function importPostmanCollection(collection) {
  const imported = [];
  const walk = (items, folder = "", inheritedAuth = null) => {
    for (const item of items || []) {
      if (Array.isArray(item.item)) {
        walk(item.item, [folder, item.name].filter(Boolean).join(" / "), item.auth || inheritedAuth);
        continue;
      }
      const request = item.request;
      if (!request) continue;
      const headers = Array.isArray(request.header)
        ? request.header.filter(header => !header.disabled).map(header => ({ name: header.key || header.name || "", value: header.value || "" }))
        : [];
      const auth = postmanAuthToParts(request.auth || inheritedAuth);
      const body = postmanBodyToParts(request.body);
      imported.push(savedRequestFromParts({
        name: item.name, folder,
        method: request.method || "GET",
        url: postmanUrlToString(request.url),
        headers,
        authType: auth.authType, authToken: auth.authToken,
        authKeyName: auth.authKeyName, authKeyIn: auth.authKeyIn,
        contentType: body.contentType, body: body.bodyText,
        description: typeof request.description === "string" ? request.description : (typeof item.description === "string" ? item.description : "")
      }));
    }
  };
  walk(collection.item, "", collection.auth || null);
  if (!imported.length) throw new Error("Postman collection did not contain any requests.");
  return imported;
}

export function exportPostmanCollection(collections) {
  const buildItem = item => {
    const headers = parseHeaderRows(item.headers).filter(row => row.name).map(row => ({ key: row.name, value: row.value, type: "text" }));
    const bodyMode = inferBodyMode(item.contentType);
    const request = { method: item.method || "GET", header: headers, url: { raw: item.url || "" } };
    const exportedAuthType = normalizeAuthType(item.authType, item.authToken);
    if (exportedAuthType === "bearer") {
      request.auth = { type: "bearer", bearer: [{ key: "token", value: item.authToken || "", type: "string" }] };
    } else if (exportedAuthType === "basic") {
      const [username = "", password = ""] = String(item.authToken || "").split(":");
      request.auth = { type: "basic", basic: [{ key: "username", value: username, type: "string" }, { key: "password", value: password, type: "string" }] };
    } else if (exportedAuthType === "apikey" && item.authKeyName) {
      request.auth = { type: "apikey", apikey: [{ key: "key", value: item.authKeyName, type: "string" }, { key: "value", value: item.authToken || "", type: "string" }, { key: "in", value: item.authKeyIn || "header", type: "string" }] };
    }
    if (item.body) {
      request.body = bodyMode === "form"
        ? { mode: "urlencoded", urlencoded: Array.from(new URLSearchParams(item.body).entries()).map(([key, value]) => ({ key, value, type: "text" })) }
        : { mode: "raw", raw: item.body, options: { raw: { language: bodyMode === "text" ? "text" : "json" } } };
    }
    if (item.description) request.description = item.description;
    return { name: item.name || item.url || "Request", request, ...(item.description ? { description: item.description } : {}) };
  };
  const rootItems = [];
  const appendToFolder = (items, folder, requestItem) => {
    const parts = normalizeFolder(folder).split(" / ").filter(Boolean);
    let currentItems = items;
    for (const part of parts) {
      let folderItem = currentItems.find(item => item.name === part && Array.isArray(item.item) && !item.request);
      if (!folderItem) { folderItem = { name: part, item: [] }; currentItems.push(folderItem); }
      currentItems = folderItem.item;
    }
    currentItems.push(requestItem);
  };
  for (const item of collections) {
    const folder = normalizeFolder(item.folder);
    if (!folder) rootItems.push(buildItem(item));
    else appendToFolder(rootItems, folder, buildItem(item));
  }
  return {
    info: { name: "Accessible API Tester Collection", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", _postman_id: createId() },
    item: rootItems
  };
}

// ── Insomnia import ───────────────────────────────────────────────────────────

export function importInsomniaCollection(data) {
  if (data.__export_format !== 4) throw new Error("Only Insomnia export format v4 is supported.");
  const resources = Array.isArray(data.resources) ? data.resources : [];
  const nodeById = new Map(resources.map(r => [r._id, r]));
  const getFolderPath = (id, depth = 0) => {
    if (!id || depth > 10) return "";
    const node = nodeById.get(id);
    if (!node || node._type === "workspace") return "";
    const parent = getFolderPath(node.parentId, depth + 1);
    const label = String(node.name || "").trim();
    return parent ? `${parent} / ${label}` : label;
  };
  const imported = [];
  for (const req of resources.filter(r => r._type === "request")) {
    let authType = "none", authToken = "", authKeyName = "", authKeyIn = "header";
    const auth = req.authentication;
    if (auth?.type) {
      if (auth.type === "bearer") { authType = "bearer"; authToken = auth.token || ""; }
      else if (auth.type === "basic") { authType = "basic"; authToken = `${auth.username || ""}:${auth.password || ""}`; }
      else if (auth.type === "apikey") {
        authType = auth.key && auth.value ? "apikey" : "none";
        authToken = auth.value || ""; authKeyName = auth.key || "";
        authKeyIn = auth.addTo === "queryParams" ? "query" : "header";
      }
    }
    let body = "", contentType = "application/json";
    if (req.body) {
      contentType = req.body.mimeType || contentType;
      if (typeof req.body.text === "string") body = req.body.text;
      else if (Array.isArray(req.body.params)) {
        const p = new URLSearchParams();
        req.body.params.filter(x => !x.disabled).forEach(x => p.append(String(x.name || ""), String(x.value || "")));
        body = p.toString();
      }
    }
    const headers = Array.isArray(req.headers)
      ? req.headers.filter(h => !h.disabled).map(h => ({ name: String(h.name || "").trim(), value: String(h.value || "").trim() })).filter(h => h.name)
      : [];
    const url = typeof req.url === "string" ? req.url : (req.url?.raw || "");
    try {
      imported.push(savedRequestFromParts({ name: String(req.name || "").trim() || "Unnamed", folder: getFolderPath(req.parentId), method: String(req.method || "GET").toUpperCase(), url, headers, authType, authToken, authKeyName, authKeyIn, contentType, body, description: typeof req.description === "string" ? req.description : "" }));
    } catch { /* skip invalid */ }
  }
  if (!imported.length) throw new Error("No requests found in the Insomnia export.");
  return imported;
}

// ── Generic import ────────────────────────────────────────────────────────────

export function importRequestsFromJson(parsed) {
  if (parsed?._type === "export" && parsed.__export_format === 4) return importInsomniaCollection(parsed);
  if (parsed?.info?.schema && Array.isArray(parsed.item)) return importPostmanCollection(parsed);
  const imported = Array.isArray(parsed) ? parsed : parsed.requests;
  if (!Array.isArray(imported)) throw new Error("Import file must be an Accessible API Tester export, a Postman Collection v2.1 file, or a requests array.");
  return imported.map(item => savedRequestFromParts({
    name: item.name, folder: item.folder, method: item.method, url: item.url,
    headers: parseHeaderRows(item.headers || "").filter(row => row.name),
    authType: item.authType, authToken: item.authToken,
    authKeyName: item.authKeyName, authKeyIn: item.authKeyIn,
    contentType: item.contentType, body: item.body,
    assertions: item.assertions, captures: item.captures,
    preRequestScript: item.preRequestScript, postResponseScript: item.postResponseScript,
    description: item.description || ""
  }));
}
