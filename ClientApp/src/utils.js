import { BUILTIN_VARIABLES } from "./scriptEngine.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
export const PAGE_SIZE = 25;
export const SECTION_TITLES = {
  home: "Home",
  workspace: "Workspace",
  requests: "Requests",
  collections: "Collections",
  history: "History",
  variables: "Variables",
  environments: "Environments",
  mocks: "Mock Server",
  oauth: "Google OAuth",
  settings: "Settings"
};
export const emptyAssertions = {
  statusCode: "",
  bodyContains: "",
  headerName: "",
  headerValue: "",
  maxDurationMs: "",
  bodyMatchesRegex: "",
  jsonpathAssertions: []
};
export const defaultAssertionSummary = { total: 0, failed: [], message: "Not run" };
export const emptyRequest = {
  name: "",
  folder: "",
  method: "GET",
  url: "",
  params: "",
  paramRows: [{ enabled: true, name: "", value: "" }],
  headers: "",
  headerRows: [{ enabled: true, name: "", value: "" }],
  authType: "none",
  authToken: "",
  authKeyName: "",
  authKeyIn: "header",
  bodyMode: "json",
  contentType: "application/json",
  body: "",
  formRows: [{ enabled: true, name: "", value: "" }],
  graphqlVariables: "",
  multipartFileRows: [],
  assertions: emptyAssertions,
  captures: [],
  preRequestScript: "",
  postResponseScript: "",
  timeoutSeconds: "",
  description: ""
};
export const emptyMock = {
  name: "",
  method: "GET",
  path: "/",
  statusCode: "200",
  contentType: "application/json",
  headers: "",
  body: "",
  delayMs: ""
};

// ── App helpers ───────────────────────────────────────────────────────────────

export function storageJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

// Safe localStorage write: history entries now carry full response bodies, so a
// large payload can blow past the browser quota. Swallow the failure (the backend
// store remains the source of truth) rather than breaking the send flow.
export function setStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function cloneRequestDraft(source = emptyRequest) {
  return {
    ...emptyRequest,
    ...source,
    paramRows: Array.isArray(source.paramRows) ? source.paramRows.map(row => ({ ...row })) : parseParamRows(source.params || ""),
    headerRows: Array.isArray(source.headerRows) ? source.headerRows.map(row => ({ ...row })) : parseHeaderRows(source.headers || ""),
    formRows: Array.isArray(source.formRows) ? source.formRows.map(row => ({ ...row })) : parseFormRows(source.body || ""),
    graphqlVariables: source.graphqlVariables || "",
    multipartFileRows: Array.isArray(source.multipartFileRows) ? source.multipartFileRows.map(row => ({ ...row, file: null })) : [],
    assertions: normalizeAssertions(source.assertions),
    captures: Array.isArray(source.captures) ? source.captures.map(c => ({ ...c })) : [],
    preRequestScript: source.preRequestScript || "",
    postResponseScript: source.postResponseScript || "",
    description: source.description || ""
  };
}

export function createRequestTab(request = emptyRequest, response = null, assertionSummary = defaultAssertionSummary) {
  return {
    id: createId(),
    request: cloneRequestDraft(request),
    response,
    assertionSummary: {
      total: assertionSummary.total || 0,
      failed: Array.isArray(assertionSummary.failed) ? [...assertionSummary.failed] : [],
      message: assertionSummary.message || "Not run"
    },
    scriptResult: null
  };
}

// Rebuild the request-tab workspace from a persisted (JSON-serialized) snapshot.
// Request drafts are normalized through createRequestTab/cloneRequestDraft (which
// resets un-serializable file uploads to null); each tab's stored response and
// script/assertion state are carried back so a refresh restores where you left off.
// Returns null when there's nothing usable to restore.
export function rehydrateRequestWorkspace(saved) {
  if (!saved || !Array.isArray(saved.tabs) || saved.tabs.length === 0) return null;
  const tabs = saved.tabs.map(entry => {
    const normalized = createRequestTab(entry.request || emptyRequest, entry.response || null, entry.assertionSummary || defaultAssertionSummary);
    return {
      ...entry,
      ...normalized,
      id: entry.id || normalized.id,
      request: normalized.request,
      response: entry.response || null,
      scriptResult: entry.scriptResult || null
    };
  });
  const activeId = tabs.some(tab => tab.id === saved.activeId) ? saved.activeId : tabs[0].id;
  return { tabs, activeId };
}

export function requestTabTitle(tab) {
  const request = tab.request || emptyRequest;
  return request.name?.trim() || request.url?.trim() || "Untitled";
}

export function requestTabCloseLabel(tab) {
  const request = tab.request || emptyRequest;
  const name = request.name?.trim();
  const url = request.url?.trim();
  if (name) return `Close tab: ${name}`;
  if (url) return `Close tab: ${request.method || "GET"} ${url}`;
  return "Close empty request tab";
}

export function requestTabAriaLabel(tab) {
  const request = tab.request || emptyRequest;
  const name = request.name?.trim();
  const url = request.url?.trim();
  const method = request.method || "GET";
  if (name) return `${name}, ${method}`;
  if (url) return `${method} ${url}`;
  return `New empty request, ${method}`;
}

// ── Parsing & serialization ───────────────────────────────────────────────────

export function normalizeAuthType(value, token = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "bearer") return "bearer";
  if (normalized === "basic") return "basic";
  if (normalized === "apikey") return "apikey";
  if (normalized === "none") return "none";
  return String(token || "").trim() ? "bearer" : "none";
}

export function parseHeaders(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`Header is missing a colon: ${line}`);
      return { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
}

export function parseHeaderRows(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf(":");
      return separator < 1
        ? { enabled: true, name: line, value: "" }
        : { enabled: true, name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
  return rows.length ? rows : [{ enabled: true, name: "", value: "" }];
}

export function serializeHeaderRows(rows) {
  if (!Array.isArray(rows)) return "";
  return rows
    .filter(row => row?.enabled !== false)
    .map(row => ({ name: String(row?.name || "").trim(), value: String(row?.value || "").trim() }))
    .filter(row => row.name || row.value)
    .map(row => {
      if (!row.name) throw new Error("Header names cannot be empty.");
      return `${row.name}: ${row.value}`;
    })
    .join("\n");
}

export function parseParamRows(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separator = line.indexOf("=");
      return separator < 0
        ? { enabled: true, name: line, value: "" }
        : { enabled: true, name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
  return rows.length ? rows : [{ enabled: true, name: "", value: "" }];
}

export function serializeParamRows(rows) {
  if (!Array.isArray(rows)) return "";
  return rows
    .filter(row => row?.enabled !== false)
    .map(row => ({ name: String(row?.name || "").trim(), value: String(row?.value || "").trim() }))
    .filter(row => row.name || row.value)
    .map(row => {
      if (!row.name) throw new Error("Query parameter names cannot be empty.");
      return `${row.name}=${row.value}`;
    })
    .join("\n");
}

export function emptyKeyValueRows() {
  return [{ enabled: true, name: "", value: "" }];
}

export function parseFormRows(text) {
  const parameters = new URLSearchParams(String(text || ""));
  const rows = Array.from(parameters.entries()).map(([name, value]) => ({ enabled: true, name, value }));
  return rows.length ? rows : emptyKeyValueRows();
}

export function serializeKeyValueRows(rows, label) {
  if (!Array.isArray(rows)) return "";
  const parameters = new URLSearchParams();
  for (const row of rows) {
    if (row?.enabled === false) continue;
    const name = String(row?.name || "").trim();
    const value = String(row?.value || "").trim();
    if (!name && !value) continue;
    if (!name) throw new Error(`${label} names cannot be empty.`);
    parameters.append(name, value);
  }
  return parameters.toString();
}

export function inferBodyMode(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("application/x-www-form-urlencoded")) return "form";
  if (normalized.includes("multipart/form-data")) return "multipart";
  if (normalized.includes("text/plain")) return "text";
  return "json";
}

export function bodyContentTypeForMode(mode, contentType) {
  if (mode === "form") return "application/x-www-form-urlencoded";
  if (mode === "multipart") return "multipart/form-data";
  if (mode === "text") return "text/plain";
  if (mode === "graphql") return "application/json";
  return String(contentType || "").trim() || "application/json";
}

export function parseGraphqlBody(body) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed.query === "string") {
      return { query: parsed.query, variables: JSON.stringify(parsed.variables ?? {}, null, 2) };
    }
  } catch { /* not graphql JSON */ }
  return null;
}

// Strict check that a request body is a GraphQL-over-HTTP envelope, i.e. a JSON
// object with a string `query` and no keys beyond query/variables/operationName.
// Used to recover GraphQL mode when restoring items that predate bodyMode being
// persisted (history entries, older saved requests).
export function isGraphqlEnvelope(body) {
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    if (typeof parsed.query !== "string") return false;
    const allowed = new Set(["query", "variables", "operationName"]);
    return Object.keys(parsed).every(key => allowed.has(key));
  } catch { return false; }
}

// ── GraphQL error highlighting ──────────────────────────────────────────────
// GraphQL endpoints return HTTP 200 even on failure, carrying problems in an
// `errors` array. Pull those out of a response body so the UI can surface them.
export function parseGraphqlErrors(body) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length) {
      return parsed.errors.map(error => ({
        message: typeof error?.message === "string" ? error.message : JSON.stringify(error),
        path: Array.isArray(error?.path) ? error.path.join(" → ") : null,
        locations: Array.isArray(error?.locations)
          ? error.locations.map(loc => `line ${loc.line}, col ${loc.column}`).join("; ")
          : null,
      }));
    }
  } catch { /* not JSON */ }
  return null;
}

// ── GraphQL query validation & formatting ───────────────────────────────────
// Best-effort: ignores string/comment contents and checks delimiter balance.
// Not a full GraphQL parser, but catches the common structural mistakes.
export function validateGraphqlQuery(query) {
  const text = String(query || "");
  if (!text.trim()) return "Query is empty.";
  const stack = [];
  const openers = { ")": "(", "]": "[", "}": "{" };
  let inString = false, inBlock = false, inComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inComment) { if (c === "\n") inComment = false; continue; }
    if (inBlock) { if (text.slice(i, i + 3) === '"""') { inBlock = false; i += 2; } continue; }
    if (inString) { if (c === "\\") { i++; } else if (c === '"') inString = false; continue; }
    if (text.slice(i, i + 3) === '"""') { inBlock = true; i += 2; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === "#") { inComment = true; continue; }
    if (c === "{" || c === "(" || c === "[") stack.push(c);
    else if (c === ")" || c === "]" || c === "}") {
      if (stack.pop() !== openers[c]) return `Unbalanced "${c}" in query.`;
    }
  }
  if (inString || inBlock) return "Unterminated string literal in query.";
  if (stack.length) {
    const closer = { "{": "}", "(": ")", "[": "]" }[stack[stack.length - 1]];
    return `Missing closing "${closer}".`;
  }
  if (!/\{/.test(text)) return "Query has no selection set ({ … }).";
  // The document must begin with an operation/fragment keyword or an anonymous
  // selection set "{". Catches stray text glued to the front (e.g. "emojiquery").
  const cleaned = text.replace(/#[^\n]*(\n|$)/g, " ").replace(/^\s+/, "");
  if (cleaned && !cleaned.startsWith("{")) {
    const word = (cleaned.match(/^[A-Za-z_][A-Za-z0-9_]*/) || [""])[0];
    if (!["query", "mutation", "subscription", "fragment"].includes(word)) {
      return `Query must start with "query", "mutation", "subscription", "fragment", or "{" — found "${word || cleaned[0]}".`;
    }
  }
  return null;
}

// Finds the closing-brace index of the deepest selection set, so a field can be
// dropped inside the innermost block when the user hasn't placed a caret. Skips
// string/comment contents. Returns -1 when the query has no braces.
export function graphqlDeepestClosePos(body) {
  const text = String(body || "");
  const scan = (onClose) => {
    let depth = 0, inString = false, inBlock = false, inComment = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inComment) { if (c === "\n") inComment = false; continue; }
      if (inBlock) { if (text.slice(i, i + 3) === '"""') { inBlock = false; i += 2; } continue; }
      if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; continue; }
      if (text.slice(i, i + 3) === '"""') { inBlock = true; i += 2; continue; }
      if (c === '"') { inString = true; continue; }
      if (c === "#") { inComment = true; continue; }
      if (c === "{") { depth++; if (depth > maxDepth) maxDepth = depth; }
      else if (c === "}") { if (onClose(i, depth)) return i; depth--; }
    }
    return -1;
  };
  let maxDepth = 0;
  scan(() => false);                       // pass 1: measure depth
  if (maxDepth === 0) return -1;
  return scan((i, depth) => depth === maxDepth); // pass 2: first close at max depth
}

// Direct field names of the selection set that encloses `index` (nested
// sub-selections and argument lists excluded). Used to prevent inserting a
// field that already exists in the same block, while still allowing the same
// field name in a different block.
function extractDirectFields(inner) {
  let s = inner, prev;
  do { prev = s; s = s.replace(/\{[^{}]*\}/g, " "); } while (s !== prev); // drop nested selection sets
  do { prev = s; s = s.replace(/\([^()]*\)/g, " "); } while (s !== prev); // drop argument lists
  const names = [];
  for (const token of s.split(/[\s,]+/)) {
    if (!token) continue;
    const raw = token.includes(":") ? token.slice(token.lastIndexOf(":") + 1) : token; // strip alias
    const name = raw.replace(/[^A-Za-z0-9_]/g, "");
    if (name) names.push(name);
  }
  return names;
}

export function graphqlBlockDirectFields(body, index) {
  const text = String(body || "");
  const stack = [];
  let inString = false, inBlock = false, inComment = false;
  let enclosingOpen = null;
  for (let i = 0; i <= text.length; i++) {
    if (i === index) enclosingOpen = stack.length ? stack[stack.length - 1] : null;
    if (i === text.length) break;
    const c = text[i];
    if (inComment) { if (c === "\n") inComment = false; continue; }
    if (inBlock) { if (text.slice(i, i + 3) === '"""') { inBlock = false; i += 2; } continue; }
    if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; continue; }
    if (text.slice(i, i + 3) === '"""') { inBlock = true; i += 2; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === "#") { inComment = true; continue; }
    if (c === "{") { stack.push(i); }
    else if (c === "}") { const open = stack.pop(); if (enclosingOpen != null && open === enclosingOpen) return extractDirectFields(text.slice(enclosingOpen + 1, i)); }
  }
  if (enclosingOpen == null) return [];
  return extractDirectFields(text.slice(enclosingOpen + 1)); // enclosing block not yet closed
}

export function graphqlFieldAlreadyInBlock(body, index, field) {
  return graphqlBlockDirectFields(body, index).includes(field);
}

// Removes the first direct-field occurrence of `field` from the query, including
// any argument list and sub-selection it carries, and tidies the surrounding
// whitespace. Leaves the text unchanged if the field isn't found as a field.
// Best-effort (no full parser): skips string/comment contents and ignores
// argument names and alias labels.
export function graphqlRemoveFieldFromQuery(body, field) {
  const text = String(body || "");
  const name = String(field || "");
  if (!name) return text;
  const skipBalanced = (start, open, close) => {
    let depth = 0;
    for (let p = start; p < text.length; p++) {
      if (text[p] === open) depth++;
      else if (text[p] === close) { depth--; if (depth === 0) return p + 1; }
    }
    return text.length;
  };
  let inString = false, inBlock = false, inComment = false, braceDepth = 0, parenDepth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inComment) { if (c === "\n") inComment = false; continue; }
    if (inBlock) { if (text.slice(i, i + 3) === '"""') { inBlock = false; i += 2; } continue; }
    if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; continue; }
    if (text.slice(i, i + 3) === '"""') { inBlock = true; i += 2; continue; }
    if (c === '"') { inString = true; continue; }
    if (c === "#") { inComment = true; continue; }
    if (c === "{") { braceDepth++; continue; }
    if (c === "}") { braceDepth--; continue; }
    if (c === "(") { parenDepth++; continue; }
    if (c === ")") { parenDepth--; continue; }
    if (braceDepth >= 1 && parenDepth === 0 && /[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
      const ident = text.slice(i, j);
      let k = j; while (k < text.length && /\s/.test(text[k])) k++;
      const isAliasLabel = text[k] === ":";
      const prevNonWs = (() => { let p = i - 1; while (p >= 0 && /\s/.test(text[p])) p--; return text[p]; })();
      if (ident === name && !isAliasLabel && prevNonWs !== "$" && prevNonWs !== ".") {
        // Field extent: name, optional (...) args, optional { … } sub-selection.
        let end = j, m = j;
        while (m < text.length && /\s/.test(text[m])) m++;
        if (text[m] === "(") { end = skipBalanced(m, "(", ")"); m = end; while (m < text.length && /\s/.test(text[m])) m++; }
        if (text[m] === "{") { end = skipBalanced(m, "{", "}"); }
        // Trim surrounding whitespace so no blank line / double space remains.
        let s = i;
        while (s > 0 && (text[s - 1] === " " || text[s - 1] === "\t")) s--;
        let e = end;
        while (e < text.length && (text[e] === " " || text[e] === "\t")) e++;
        const prevCh = s > 0 ? text[s - 1] : "";
        const nextCh = e < text.length ? text[e] : "";
        let replacement = "";
        if ((s === 0 || prevCh === "\n") && nextCh === "\n") {
          e++; // whole line removal — also drop the trailing newline
        } else if (prevCh && nextCh && !/\s/.test(prevCh) && !/\s/.test(nextCh) && prevCh !== "{" && nextCh !== "}") {
          replacement = " "; // inline neighbours — keep them separated
        }
        return text.slice(0, s) + replacement + text.slice(e);
      }
      i = j - 1;
    }
  }
  return text;
}

// Validates the GraphQL variables box. Returns an error string, or null when
// empty/valid. Must be a JSON object (not an array or primitive).
export function validateGraphqlVariables(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  let parsed;
  try { parsed = JSON.parse(trimmed); }
  catch { return "Not valid JSON — use straight quotes (\") and remove any stray text."; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "Variables must be a JSON object, e.g. { \"id\": 1 }.";
  }
  return null;
}

// True when the query references at least one $variable.
export function graphqlQueryUsesVariables(query) {
  return /\$[A-Za-z_][A-Za-z0-9_]*/.test(String(query || ""));
}

// Re-indents a GraphQL query by brace depth. Expands braces onto their own
// lines (skipping string/comment contents) then re-indents. Best-effort: a "{"
// inside a string on a single line can skew indentation, which is rare in
// operation documents. Existing line breaks between fields are preserved.
export function formatGraphqlQuery(query) {
  const src = String(query || "").replace(/\r\n/g, "\n");
  let expanded = "";
  let inString = false, inBlock = false, inComment = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inComment) { expanded += c; if (c === "\n") inComment = false; continue; }
    if (inBlock) { expanded += c; if (src.slice(i, i + 3) === '"""') { expanded += '""'; i += 2; inBlock = false; } continue; }
    if (inString) { expanded += c; if (c === "\\") { expanded += src[++i] ?? ""; } else if (c === '"') inString = false; continue; }
    if (src.slice(i, i + 3) === '"""') { inBlock = true; expanded += '"""'; i += 2; continue; }
    if (c === '"') { inString = true; expanded += c; continue; }
    if (c === "#") { inComment = true; expanded += c; continue; }
    if (c === "{") { expanded = expanded.replace(/[ \t]+$/, "") + " {\n"; continue; }
    if (c === "}") { expanded = expanded.replace(/\s+$/, "") + "\n}\n"; continue; }
    expanded += c;
  }
  let depth = 0;
  const out = [];
  for (const raw of expanded.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let leadingClosers = 0;
    for (const ch of line) { if (ch === "}") leadingClosers++; else break; }
    out.push("  ".repeat(Math.max(0, depth - leadingClosers)) + line);
    const open = (line.match(/\{/g) || []).length;
    const close = (line.match(/\}/g) || []).length;
    depth = Math.max(0, depth + open - close);
  }
  return out.join("\n").trim();
}

// ── GraphQL schema introspection ────────────────────────────────────────────
export const GRAPHQL_INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      description
      fields(includeDeprecated: true) { name description type { ...TypeRef } args { name type { ...TypeRef } } }
      inputFields { name type { ...TypeRef } }
      enumValues(includeDeprecated: true) { name }
    }
  }
}
fragment TypeRef on __Type {
  kind name
  ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } }
}`;

function gqlTypeName(typeRef) {
  if (!typeRef) return "";
  if (typeRef.kind === "NON_NULL") return `${gqlTypeName(typeRef.ofType)}!`;
  if (typeRef.kind === "LIST") return `[${gqlTypeName(typeRef.ofType)}]`;
  return typeRef.name || "";
}

// Turns a raw introspection response into a compact, render-friendly schema.
export function parseIntrospectionSchema(json) {
  const schema = json?.data?.__schema || json?.__schema;
  if (!schema || !Array.isArray(schema.types)) return null;
  const rootNames = {
    query: schema.queryType?.name || null,
    mutation: schema.mutationType?.name || null,
    subscription: schema.subscriptionType?.name || null,
  };
  const types = schema.types
    .filter(type => type && type.name && !type.name.startsWith("__"))
    .map(type => ({
      name: type.name,
      kind: type.kind,
      description: type.description || "",
      fields: [
        ...(Array.isArray(type.fields) ? type.fields : []),
        ...(Array.isArray(type.inputFields) ? type.inputFields : []),
      ].map(field => ({
        name: field.name,
        type: gqlTypeName(field.type),
        args: Array.isArray(field.args) ? field.args.map(arg => ({ name: arg.name, type: gqlTypeName(arg.type) })) : [],
        description: field.description || "",
      })),
      enumValues: Array.isArray(type.enumValues) ? type.enumValues.map(value => value.name) : [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { rootNames, types };
}

export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Variable resolution ───────────────────────────────────────────────────────

export function resolveVariables(text, variables, collectionVariables = []) {
  const missing = new Set();
  const envMap = new Map(variables.map(item => [item.name, item.value]));
  const colMap = new Map(collectionVariables.map(item => [item.name, item.value]));
  const resolved = String(text ?? "").replace(/\{\{\s*(\$[A-Za-z][A-Za-z0-9_]*|[A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, (match, name) => {
    if (name.startsWith("$")) {
      const gen = BUILTIN_VARIABLES[name.slice(1)];
      return gen ? gen() : match;
    }
    if (envMap.has(name)) return envMap.get(name);
    if (colMap.has(name)) return colMap.get(name);
    missing.add(name);
    return match;
  });
  if (missing.size) throw new Error(`Missing variable${missing.size === 1 ? "" : "s"}: ${Array.from(missing).join(", ")}.`);
  return resolved;
}

export function applyAuthorization(headers, type, token, keyName = "", keyIn = "header") {
  const authType = normalizeAuthType(type, token);
  if (authType === "none") return headers;
  const trimmedToken = String(token || "").trim();
  if (!trimmedToken) throw new Error("Enter credentials or choose No auth.");
  if (authType === "apikey") {
    if (keyIn === "query") return headers;
    const trimmedKeyName = String(keyName || "").trim();
    if (!trimmedKeyName) throw new Error("Enter an API key name.");
    return [...headers, { name: trimmedKeyName, value: trimmedToken }];
  }
  if (headers.some(header => header.name.toLowerCase() === "authorization")) {
    throw new Error("Use either the Authorization section or an Authorization header, not both.");
  }
  if (authType === "basic") {
    if (!trimmedToken.includes(":")) throw new Error("Basic auth credentials must use username:password.");
    return [...headers, { name: "Authorization", value: `Basic ${btoa(trimmedToken)}` }];
  }
  return [...headers, { name: "Authorization", value: `Bearer ${trimmedToken}` }];
}

export function appendQueryParams(url, paramsText) {
  const trimmedUrl = String(url || "").trim();
  const lines = String(paramsText || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) return trimmedUrl;
  const parameters = new URLSearchParams();
  for (const line of lines) {
    const separator = line.indexOf("=");
    if (separator < 0) throw new Error(`Query parameter is missing equals sign: ${line}`);
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!name) throw new Error("Query parameter names cannot be empty.");
    parameters.append(name, value);
  }
  const joiner = trimmedUrl.includes("?") ? trimmedUrl.endsWith("?") || trimmedUrl.endsWith("&") ? "" : "&" : "?";
  return `${trimmedUrl}${joiner}${parameters}`;
}

// Splits a URL into its base (path, minus the query string) and the query
// parameters as editable rows. Used when restoring a request whose params were
// folded into the URL (e.g. history entries), so the Query params table is
// repopulated instead of showing blank.
export function extractUrlParams(url) {
  const text = String(url || "");
  const hashIndex = text.indexOf("#");
  const hash = hashIndex >= 0 ? text.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? text.slice(0, hashIndex) : text;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex < 0) return { base: text, rows: [] };
  const base = withoutHash.slice(0, queryIndex) + hash;
  const parameters = new URLSearchParams(withoutHash.slice(queryIndex + 1));
  const rows = Array.from(parameters.entries()).map(([name, value]) => ({ enabled: true, name, value }));
  return { base, rows };
}

// Returns the URL with its query string removed (everything from "?" onward).
export function stripUrlQuery(url) {
  const text = String(url || "");
  const queryIndex = text.indexOf("?");
  return queryIndex < 0 ? text : text.slice(0, queryIndex);
}

// Raw (no encode/decode) split of a URL into base + param rows. Used for the
// live URL<->params table sync so the text the user types in the URL bar is
// preserved byte-for-byte (avoids caret jumps from re-encoding). For sending,
// buildRequest still re-encodes via appendQueryParams.
export function parseUrlQueryRaw(url) {
  const text = String(url || "");
  const queryIndex = text.indexOf("?");
  if (queryIndex < 0) return { base: text, rows: [] };
  const rows = text.slice(queryIndex + 1)
    .split("&")
    .filter(Boolean)
    .map(pair => {
      const separator = pair.indexOf("=");
      return separator < 0
        ? { enabled: true, name: pair, value: "" }
        : { enabled: true, name: pair.slice(0, separator), value: pair.slice(separator + 1) };
    });
  return { base: text.slice(0, queryIndex), rows };
}

// Builds the "?a=1&b=2" query string (raw, no encoding) from enabled param rows
// that have a name. Mirror of parseUrlQueryRaw so URL bar <-> table round-trips.
export function buildBarQuery(rows) {
  if (!Array.isArray(rows)) return "";
  const parts = rows
    .filter(row => row && row.enabled !== false && String(row.name || "").length)
    .map(row => {
      const name = String(row.name || "");
      const value = String(row.value || "");
      return value.length ? `${name}=${value}` : name;
    });
  return parts.length ? `?${parts.join("&")}` : "";
}

// ── Assertions ────────────────────────────────────────────────────────────────

export function normalizeAssertions(assertions) {
  if (!assertions || typeof assertions !== "object") return { ...emptyAssertions };
  return {
    statusCode: assertions.statusCode ?? "",
    bodyContains: assertions.bodyContains || "",
    headerName: assertions.headerName || "",
    headerValue: assertions.headerValue || "",
    maxDurationMs: assertions.maxDurationMs ?? "",
    bodyMatchesRegex: assertions.bodyMatchesRegex || "",
    jsonpathAssertions: Array.isArray(assertions.jsonpathAssertions)
      ? assertions.jsonpathAssertions.map(a => ({
          id: a.id || createId(),
          path: a.path || "",
          operator: a.operator || "equals",
          expected: a.expected ?? ""
        }))
      : []
  };
}

export function readOptionalInt(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return number;
}

export function buildAssertions(formAssertions) {
  const assertions = normalizeAssertions(formAssertions);
  const statusCode = readOptionalInt(assertions.statusCode, "Expected status", 100, 599);
  const maxDurationMs = readOptionalInt(assertions.maxDurationMs, "Max time", 1, 600000);
  const bodyContains = assertions.bodyContains.trim();
  const headerName = assertions.headerName.trim();
  const headerValue = assertions.headerValue.trim();
  if (headerValue && !headerName) throw new Error("Enter a header name before checking a header value.");
  const bodyMatchesRegex = assertions.bodyMatchesRegex.trim();
  if (bodyMatchesRegex) { try { new RegExp(bodyMatchesRegex); } catch { throw new Error("Body regex is not a valid regular expression."); } }
  const jsonpathAssertions = (assertions.jsonpathAssertions || [])
    .filter(a => a.path?.trim())
    .map(a => ({ id: a.id, path: a.path.trim(), operator: a.operator || "equals", expected: a.expected ?? "" }));
  const result = { statusCode, bodyContains, headerName, headerValue, maxDurationMs, bodyMatchesRegex, jsonpathAssertions };
  return hasAssertions(result) ? result : null;
}

export function hasAssertions(assertions) {
  return Boolean(assertions && (
    assertions.statusCode ||
    assertions.bodyContains ||
    assertions.headerName ||
    assertions.headerValue ||
    assertions.maxDurationMs ||
    assertions.bodyMatchesRegex ||
    (Array.isArray(assertions.jsonpathAssertions) && assertions.jsonpathAssertions.some(a => a.path?.trim()))
  ));
}

// ── Request building ──────────────────────────────────────────────────────────

export function buildRequest(form, variables, shouldResolve = true, defaultTimeoutSeconds = null, collectionVariables = []) {
  const resolve = value => shouldResolve ? resolveVariables(value, variables, collectionVariables) : value;
  const authType = normalizeAuthType(form.authType, form.authToken);
  const authToken = resolve(form.authToken);
  const authKeyName = resolve(form.authKeyName || "");
  const authKeyIn = form.authKeyIn || "header";
  const draftHeaders = Array.isArray(form.headerRows) ? serializeHeaderRows(form.headerRows) : form.headers;
  const headersText = resolve(draftHeaders);
  const headers = applyAuthorization(parseHeaders(headersText), authType, authToken, authKeyName, authKeyIn);
  const bodyMode = form.bodyMode || inferBodyMode(form.contentType);
  const resolvedFormRows = Array.isArray(form.formRows)
    ? form.formRows.map(row => ({ ...row, name: resolve(row?.name), value: resolve(row?.value) }))
    : form.formRows;
  const bodyText = (bodyMode === "form" || bodyMode === "multipart")
    ? serializeKeyValueRows(resolvedFormRows, "Form field")
    : bodyMode === "graphql"
    ? (() => {
        const query = resolve(form.body || "");
        let vars = {};
        const varsText = String(form.graphqlVariables || "").trim();
        // Only the variables actually referenced by the query matter. If the
        // query uses none, ignore whatever is in the box so leftover text never
        // blocks a send.
        const queryUsesVars = /\$[A-Za-z_][A-Za-z0-9_]*/.test(query);
        if (varsText && queryUsesVars) {
          try { vars = JSON.parse(varsText); }
          catch { throw new Error("GraphQL variables must be valid JSON — use straight quotes (\") and remove any stray text."); }
        }
        return JSON.stringify({ query, variables: vars });
      })()
    : resolve(form.body);
  const draftParams = Array.isArray(form.paramRows) ? serializeParamRows(form.paramRows) : (form.params || "");
  // When param rows are present they are authoritative (the URL bar mirrors them
  // via the live sync), so strip any query already in the URL before re-appending
  // to avoid duplication. With no param rows, keep the URL's own query so legacy
  // or imported requests that carry the query string inline still send correctly.
  const urlForQuery = draftParams.trim() ? stripUrlQuery(form.url) : form.url;
  let builtUrl = appendQueryParams(resolve(urlForQuery), resolve(draftParams));
  if (authType === "apikey" && authKeyIn === "query") {
    const trimmedKeyName = authKeyName.trim();
    const trimmedKeyValue = authToken.trim();
    if (!trimmedKeyName) throw new Error("Enter an API key name.");
    if (!trimmedKeyValue) throw new Error("Enter credentials or choose No auth.");
    builtUrl = appendQueryParams(builtUrl, `${trimmedKeyName}=${trimmedKeyValue}`);
  }
  const timeoutSeconds = form.timeoutSeconds ? parseFloat(form.timeoutSeconds) : (defaultTimeoutSeconds ? parseFloat(defaultTimeoutSeconds) : null);
  return {
    method: form.method,
    url: builtUrl,
    headers,
    headersText,
    authType,
    authToken,
    bodyMode,
    contentType: resolve(bodyContentTypeForMode(bodyMode, form.contentType)),
    body: bodyText,
    timeoutMs: timeoutSeconds > 0 ? Math.round(timeoutSeconds * 1000) : null
  };
}

// ── cURL & request helpers ────────────────────────────────────────────────────

export function parseCurlTokens(text) {
  const input = String(text || "").replace(/\\\r?\n/g, " ");
  const tokens = [];
  let current = "";
  let quote = "";
  let escaped = false;
  for (const char of input) {
    if (escaped) { current += char; escaped = false; continue; }
    if (char === "\\" && quote !== "'") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ""; else current += char; continue; }
    if (char === "'" || char === "\"") { quote = char; continue; }
    if (/\s/.test(char)) { if (current) { tokens.push(current); current = ""; } continue; }
    current += char;
  }
  if (quote) throw new Error("cURL command has an unterminated quote.");
  if (escaped) current += "\\";
  if (current) tokens.push(current);
  return tokens;
}

export function headerLinesFromHeaders(headers) {
  return headers.filter(header => header.name).map(header => `${header.name}: ${header.value}`).join("\n");
}

export function requestNameFromUrl(url, fallback = "Imported request") {
  try {
    const parsed = new URL(url.replace(/\{\{\s*([^}]+)\s*\}\}/g, "https://$1.example"));
    const path = parsed.pathname === "/" ? parsed.hostname : parsed.pathname.split("/").filter(Boolean).slice(-2).join(" / ");
    return path || fallback;
  } catch {
    return fallback;
  }
}

export function normalizeFolder(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "").replace(/\s*\/\s*/g, " / ");
}

export function savedRequestFromParts({ name, folder = "", method = "GET", url, headers = [], authType = "none", authToken = "", authKeyName = "", authKeyIn = "header", contentType = "application/json", body = "", assertions = null, captures = null, preRequestScript = "", postResponseScript = "", description = "" }) {
  const normalizedUrl = String(url || "").trim();
  if (!normalizedUrl) throw new Error("Imported request is missing a URL.");
  const normalizedHeaders = headers
    .map(header => ({ name: String(header.name || "").trim(), value: String(header.value || "").trim() }))
    .filter(header => header.name);
  const contentTypeHeader = normalizedHeaders.find(header => header.name.toLowerCase() === "content-type");
  const normalizedAuthType = normalizeAuthType(authType, authToken);
  return {
    id: createId(),
    name: String(name || "").trim() || requestNameFromUrl(normalizedUrl),
    folder: normalizeFolder(folder),
    method: String(method || "GET").trim().toUpperCase(),
    url: normalizedUrl,
    headers: headerLinesFromHeaders(normalizedHeaders.filter(header =>
      header.name.toLowerCase() !== "content-type" &&
      (normalizedAuthType === "none" || header.name.toLowerCase() !== "authorization"))),
    authType: normalizedAuthType,
    authToken: String(authToken || ""),
    authKeyName: String(authKeyName || "").trim(),
    authKeyIn: authKeyIn === "query" ? "query" : "header",
    contentType: contentTypeHeader?.value || String(contentType || "application/json"),
    body: String(body || ""),
    assertions: hasAssertions(assertions) ? normalizeAssertions(assertions) : null,
    captures: Array.isArray(captures) ? captures : [],
    preRequestScript: String(preRequestScript || ""),
    postResponseScript: String(postResponseScript || ""),
    description: String(description || ""),
    updatedAt: new Date().toISOString()
  };
}

export function parseCurlCommand(text) {
  const tokens = parseCurlTokens(text);
  if (!tokens.length) throw new Error("Paste a cURL command first.");
  if (/^curl(\.exe)?$/i.test(tokens[0])) tokens.shift();
  const headers = [];
  let method = "", url = "", body = "", authType = "none", authToken = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const nextValue = () => {
      index += 1;
      if (index >= tokens.length) throw new Error(`Missing value for ${token}.`);
      return tokens[index];
    };
    if (token === "-X" || token === "--request") method = nextValue();
    else if (token.startsWith("-X") && token.length > 2) method = token.slice(2);
    else if (token === "-H" || token === "--header") {
      const line = nextValue();
      const separator = line.indexOf(":");
      if (separator < 1) throw new Error(`Header is missing a colon: ${line}`);
      headers.push({ name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() });
    } else if (token === "-u" || token === "--user") {
      authType = "basic"; authToken = nextValue();
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--data-urlencode"].includes(token)) {
      const value = nextValue();
      body = body ? `${body}&${value}` : value;
      if (!method) method = "POST";
    } else if (token.startsWith("--url=")) {
      url = token.slice("--url=".length);
    } else if (token === "--url") {
      url = nextValue();
    } else if (token === "-I" || token === "--head") {
      method = "HEAD";
    } else if (!token.startsWith("-") && !url) {
      url = token;
    }
  }
  const authorization = headers.find(header => header.name.toLowerCase() === "authorization");
  if (authorization && /^bearer\s+/i.test(authorization.value)) {
    authType = "bearer"; authToken = authorization.value.replace(/^bearer\s+/i, "");
  }
  const contentType = headers.find(header => header.name.toLowerCase() === "content-type")?.value || (body ? "application/json" : "application/json");
  return [savedRequestFromParts({ name: requestNameFromUrl(url, "Imported cURL request"), folder: "Imported cURL", method: method || "GET", url, headers, authType, authToken, contentType, body })];
}

// ── Response formatting ───────────────────────────────────────────────────────

export function formatBytes(text, isBase64 = false) {
  let bytes;
  if (isBase64) {
    const len = text?.length ?? 0;
    const padding = (text?.match(/=+$/) || [""])[0].length;
    bytes = Math.max(0, Math.floor(len * 3 / 4) - padding);
  } else {
    bytes = new Blob([text ?? ""]).size;
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function extForMime(mime) {
  const map = {
    "application/json": ".json", "text/html": ".html", "text/xml": ".xml",
    "application/xml": ".xml", "text/csv": ".csv", "text/plain": ".txt",
    "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
    "image/svg+xml": ".svg", "application/pdf": ".pdf", "application/octet-stream": ".bin",
  };
  return map[mime] || ".txt";
}

export function prettyBody(text) {
  if (!text) return "No response body.";
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

export function getMediaCategory(mime) {
  if (!mime) return null;
  const m = mime.split(";")[0].trim().toLowerCase();
  if (m === "text/html" || m === "application/xhtml+xml") return "html";
  if (m === "image/svg+xml") return "svg";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("audio/")) return "audio";
  if (m.startsWith("video/")) return "video";
  if (m === "application/pdf") return "pdf";
  return null;
}

export function serializeRaw(result) {
  const headers = (result.headers || []).map(header => `${header.name}: ${header.value}`).join("\n");
  return `HTTP ${result.status} ${result.statusText}\n${headers}\n\n${result.body || ""}`;
}

// ── Assertions evaluation ─────────────────────────────────────────────────────

export function getJsonPath(obj, path) {
  let p = String(path || "").trim();
  if (p === "$" || p === "") return obj;
  if (p.startsWith("$.")) p = p.slice(2);
  else if (p.startsWith("$[")) p = p.slice(1);
  else if (p.startsWith("$")) p = p.slice(1);
  const parts = p.split(/\.|\[|\]/).filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

export function evaluateAssertions(result, assertions) {
  if (!hasAssertions(assertions)) return { total: 0, failed: [], message: "Not run" };
  const failed = [];

  if (assertions.statusCode && result.status !== assertions.statusCode)
    failed.push(`Expected status ${assertions.statusCode}, got ${result.status}.`);

  if (assertions.bodyContains && !String(result.body || "").includes(assertions.bodyContains))
    failed.push("Response body did not contain expected text.");

  if (assertions.headerName) {
    const matching = (result.headers || []).filter(h => h.name.toLowerCase() === assertions.headerName.toLowerCase());
    if (!matching.length) failed.push(`Header "${assertions.headerName}" was not found.`);
    else if (assertions.headerValue && !matching.some(h => String(h.value).includes(assertions.headerValue)))
      failed.push(`Header "${assertions.headerName}" did not contain expected value.`);
  }

  if (assertions.maxDurationMs && result.durationMs > assertions.maxDurationMs)
    failed.push(`Expected response within ${assertions.maxDurationMs} ms, got ${result.durationMs} ms.`);

  if (assertions.bodyMatchesRegex) {
    try {
      if (!new RegExp(assertions.bodyMatchesRegex).test(result.body || ""))
        failed.push(`Body did not match regex /${assertions.bodyMatchesRegex}/.`);
    } catch { failed.push(`Invalid regex: /${assertions.bodyMatchesRegex}/.`); }
  }

  const activeJsonpath = (assertions.jsonpathAssertions || []).filter(a => a.path?.trim());
  if (activeJsonpath.length) {
    let parsed = null;
    let parseError = false;
    if (result.body) { try { parsed = JSON.parse(result.body); } catch { parseError = true; } }

    for (const ja of activeJsonpath) {
      const path = ja.path.trim();
      const op = ja.operator || "equals";
      const exp = ja.expected ?? "";
      const noValueOps = ["exists", "notExists"];

      if (parseError && !noValueOps.includes(op)) { failed.push(`JSONPath "${path}": response is not valid JSON.`); continue; }

      const value = parsed !== null ? getJsonPath(parsed, path) : undefined;
      const exists = value !== undefined;

      if (op === "exists") { if (!exists) failed.push(`JSONPath "${path}" was not found.`); }
      else if (op === "notExists") { if (exists) failed.push(`JSONPath "${path}" was expected to be absent.`); }
      else if (!exists) { failed.push(`JSONPath "${path}" was not found.`); }
      else if (op === "equals")      { if (String(value) !== exp) failed.push(`JSONPath "${path}": expected "${exp}", got "${value}".`); }
      else if (op === "notEquals")   { if (String(value) === exp) failed.push(`JSONPath "${path}": expected value to not equal "${exp}".`); }
      else if (op === "contains")    { if (!String(value).includes(exp)) failed.push(`JSONPath "${path}": expected to contain "${exp}", got "${value}".`); }
      else if (op === "matches") {
        try { if (!new RegExp(exp).test(String(value))) failed.push(`JSONPath "${path}": "${value}" did not match /${exp}/.`); }
        catch { failed.push(`JSONPath "${path}": invalid regex /${exp}/.`); }
      }
      else if (op === "gt")          { if (!(Number(value) > Number(exp))) failed.push(`JSONPath "${path}": expected > ${exp}, got ${value}.`); }
      else if (op === "lt")          { if (!(Number(value) < Number(exp))) failed.push(`JSONPath "${path}": expected < ${exp}, got ${value}.`); }
      else if (op === "gte")         { if (!(Number(value) >= Number(exp))) failed.push(`JSONPath "${path}": expected ≥ ${exp}, got ${value}.`); }
      else if (op === "lte")         { if (!(Number(value) <= Number(exp))) failed.push(`JSONPath "${path}": expected ≤ ${exp}, got ${value}.`); }
      else if (op === "lengthEquals"){ if (value?.length !== Number(exp)) failed.push(`JSONPath "${path}": expected length ${exp}, got ${value?.length ?? "N/A"}.`); }
      else if (op === "lengthGt")    { if (!(value?.length > Number(exp))) failed.push(`JSONPath "${path}": expected length > ${exp}, got ${value?.length ?? "N/A"}.`); }
      else if (op === "lengthLt")    { if (!(value?.length < Number(exp))) failed.push(`JSONPath "${path}": expected length < ${exp}, got ${value?.length ?? "N/A"}.`); }
    }
  }

  const total = [
    assertions.statusCode, assertions.bodyContains, assertions.headerName,
    assertions.maxDurationMs, assertions.bodyMatchesRegex,
  ].filter(Boolean).length + activeJsonpath.length;

  return { total, failed, message: failed.length ? `${failed.length} of ${total} failed` : `${total} passed` };
}

export function runCaptures(response, captures) {
  if (!Array.isArray(captures) || !captures.length) return [];
  const results = [];
  let parsed = null;
  let parseError = false;
  if (response?.body) { try { parsed = JSON.parse(response.body); } catch { parseError = true; } }
  for (const capture of captures) {
    const varName = String(capture.variableName || "").trim();
    if (!varName) continue;
    const source = String(capture.source || "body").toLowerCase();
    const path = String(capture.path || "").trim();
    if (source === "status") {
      results.push({ name: varName, value: String(response?.status ?? "") });
    } else if (source === "header") {
      const found = (response?.headers || []).find(h => h.name.toLowerCase() === path.toLowerCase());
      if (found) results.push({ name: varName, value: found.value });
      else results.push({ name: varName, value: null, error: `Header "${path}" not found.` });
    } else {
      if (parseError) results.push({ name: varName, value: null, error: "Response body is not valid JSON." });
      else if (parsed == null) results.push({ name: varName, value: null, error: "No response body." });
      else {
        const extracted = getJsonPath(parsed, path);
        if (extracted === undefined) results.push({ name: varName, value: null, error: `Path "${path}" not found.` });
        else results.push({ name: varName, value: String(extracted) });
      }
    }
  }
  return results;
}

// ── Variable change helpers ───────────────────────────────────────────────────

export function applyVarChangesToList(variables, changes) {
  const next = [...variables];
  for (const [name, value] of Object.entries(changes)) {
    const strValue = String(value ?? "");
    const existing = next.find(v => v.name.toLowerCase() === name.toLowerCase());
    const saved = { id: existing?.id || createId(), name: existing?.name || name, value: strValue, updatedAt: new Date().toISOString() };
    const idx = next.findIndex(v => v.id === saved.id);
    if (idx >= 0) next[idx] = saved; else next.unshift(saved);
  }
  return next;
}

// ── Mock & snippet helpers ────────────────────────────────────────────────────

export function normalizeMockPath(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function mockUrl(item) {
  return `${location.origin}/mock${normalizeMockPath(item.path)}`;
}

export function generateSnippet(method, url, headers, body, language, contentType = "") {
  const hasBody = !!body?.trim();
  const m = (method || "GET").toUpperCase();
  // The request's Content-Type is tracked separately from the headers list, so
  // fold it in here when there's a body and the caller didn't already send one.
  const ct = String(contentType || "").trim();
  if (hasBody && ct && !headers.some(h => h.name.toLowerCase() === "content-type")) {
    headers = [...headers, { name: "Content-Type", value: ct }];
  }

  if (language === "curl") {
    const parts = [`curl -X ${m} ${JSON.stringify(url)}`];
    for (const h of headers) parts.push(`  -H ${JSON.stringify(`${h.name}: ${h.value}`)}`);
    if (hasBody) parts.push(`  -d ${JSON.stringify(body)}`);
    return parts.join(" \\\n");
  }

  if (language === "javascript") {
    const opts = [`  method: ${JSON.stringify(m)}`];
    if (headers.length) {
      const hLines = headers.map(h => `    ${JSON.stringify(h.name)}: ${JSON.stringify(h.value)}`);
      opts.push(`  headers: {\n${hLines.join(",\n")}\n  }`);
    }
    if (hasBody) opts.push(`  body: ${JSON.stringify(body)}`);
    return `const response = await fetch(${JSON.stringify(url)}, {\n${opts.join(",\n")}\n});\nconst data = await response.json();`;
  }

  if (language === "python") {
    const args = [`    ${JSON.stringify(url)}`];
    if (headers.length) {
      const hLines = headers.map(h => `        ${JSON.stringify(h.name)}: ${JSON.stringify(h.value)}`);
      args.push(`    headers={\n${hLines.join(",\n")}\n    }`);
    }
    if (hasBody) args.push(`    data=${JSON.stringify(body)}`);
    return `import requests\n\nresponse = requests.${m.toLowerCase()}(\n${args.join(",\n")}\n)\ndata = response.json()`;
  }

  if (language === "csharp") {
    const lines = ["using var client = new HttpClient();"];
    const authHeader = headers.find(h => h.name.toLowerCase() === "authorization");
    const contentTypeHeader = headers.find(h => h.name.toLowerCase() === "content-type");
    const otherHeaders = headers.filter(h => !["authorization", "content-type"].includes(h.name.toLowerCase()));
    if (authHeader) lines.push(`client.DefaultRequestHeaders.Add("Authorization", ${JSON.stringify(authHeader.value)});`);
    for (const h of otherHeaders) lines.push(`client.DefaultRequestHeaders.Add(${JSON.stringify(h.name)}, ${JSON.stringify(h.value)});`);
    if (hasBody) {
      const ct = contentTypeHeader?.value || "application/json";
      lines.push(`\nvar content = new StringContent(\n    ${JSON.stringify(body)},\n    System.Text.Encoding.UTF8,\n    ${JSON.stringify(ct)});`);
      if (m === "POST") lines.push(`var response = await client.PostAsync(${JSON.stringify(url)}, content);`);
      else if (m === "PUT") lines.push(`var response = await client.PutAsync(${JSON.stringify(url)}, content);`);
      else if (m === "PATCH") lines.push(`var response = await client.PatchAsync(${JSON.stringify(url)}, content);`);
      else lines.push(`using var message = new HttpRequestMessage(HttpMethod.${m[0] + m.slice(1).toLowerCase()}, ${JSON.stringify(url)}) { Content = content };\nvar response = await client.SendAsync(message);`);
    } else {
      if (m === "GET") lines.push(`\nvar response = await client.GetAsync(${JSON.stringify(url)});`);
      else if (m === "DELETE") lines.push(`\nvar response = await client.DeleteAsync(${JSON.stringify(url)});`);
      else lines.push(`\nvar response = await client.SendAsync(new HttpRequestMessage(HttpMethod.${m[0] + m.slice(1).toLowerCase()}, ${JSON.stringify(url)}));`);
    }
    lines.push("var body = await response.Content.ReadAsStringAsync();");
    return lines.join("\n");
  }

  return "";
}

export function isStateChangingLocalMockRequest(apiRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(String(apiRequest.method || "").toUpperCase())) return false;
  try {
    const url = new URL(apiRequest.url);
    return url.origin === location.origin && normalizeMockPath(url.pathname.replace(/^\/mock/i, "")) !== url.pathname && url.pathname.toLowerCase().startsWith("/mock");
  } catch { return false; }
}

// ── Cookie jar ────────────────────────────────────────────────────────────────

export function parseCookieValue(headerValue) {
  const parts = String(headerValue || "").split(";");
  const first = parts[0].trim();
  const eq = first.indexOf("=");
  if (eq < 1) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  let expires = null, path = "/", secure = false;
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i].trim();
    if (/^secure$/i.test(p)) { secure = true; continue; }
    const pEq = p.indexOf("=");
    if (pEq < 0) continue;
    const key = p.slice(0, pEq).trim().toLowerCase();
    const val = p.slice(pEq + 1).trim();
    if (key === "expires") { try { const t = new Date(val).getTime(); if (!isNaN(t)) expires = t; } catch {} }
    else if (key === "max-age") { const secs = parseInt(val, 10); if (!isNaN(secs)) expires = Date.now() + secs * 1000; }
    else if (key === "path") { path = val || "/"; }
  }
  return { name, value, expires, path, secure };
}

export function getCookiesForUrl(jar, url) {
  try {
    const { hostname, pathname, protocol } = new URL(url);
    const isSecure = protocol === "https:";
    const hostCookies = jar[hostname] || {};
    const now = Date.now();
    const cookies = [];
    for (const cookie of Object.values(hostCookies)) {
      if (cookie.secure && !isSecure) continue;
      if (cookie.expires !== null && now > cookie.expires) continue;
      if (!(pathname || "/").startsWith(cookie.path || "/")) continue;
      cookies.push(`${cookie.name}=${cookie.value}`);
    }
    return cookies.join("; ");
  } catch { return ""; }
}

export function updateCookieJar(jar, url, setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return jar;
  try {
    const { hostname } = new URL(url);
    const next = { ...jar, [hostname]: { ...(jar[hostname] || {}) } };
    for (const header of setCookieHeaders) {
      const parsed = parseCookieValue(header);
      if (!parsed) continue;
      if (parsed.expires !== null && Date.now() > parsed.expires) delete next[hostname][parsed.name];
      else next[hostname][parsed.name] = parsed;
    }
    if (!Object.keys(next[hostname]).length) delete next[hostname];
    return next;
  } catch { return jar; }
}

// ── Diff & collection tree ────────────────────────────────────────────────────

export function computeLineDiff(textA, textB) {
  const linesA = (textA || "").split("\n").slice(0, 1500);
  const linesB = (textB || "").split("\n").slice(0, 1500);
  const m = linesA.length, n = linesB.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = linesA[i-1] === linesB[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const diff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i-1] === linesB[j-1]) { diff.push({ type: "same", text: linesA[i-1] }); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { diff.push({ type: "added", text: linesB[j-1] }); j--; }
    else { diff.push({ type: "removed", text: linesA[i-1] }); i--; }
  }
  return diff.reverse();
}

export function buildCollectionTree(items) {
  const noFolderItems = [];
  const pathToNode = new Map();
  const topNodes = [];
  const getOrCreate = (path) => {
    if (pathToNode.has(path)) return pathToNode.get(path);
    const parts = path.split(" / ");
    const label = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join(" / ");
    const node = { label, path, items: [], children: [] };
    pathToNode.set(path, node);
    if (parentPath) getOrCreate(parentPath).children.push(node);
    else topNodes.push(node);
    return node;
  };
  for (const item of items) {
    const folder = normalizeFolder(item.folder) || "";
    if (!folder) noFolderItems.push(item);
    else getOrCreate(folder).items.push(item);
  }
  return { noFolderItems, topNodes };
}

// ── Folder inheritance ────────────────────────────────────────────────────────

export function applyFolderInheritance(form, fSettings) {
  const folderPath = normalizeFolder(form.folder || "");
  const parts = folderPath ? folderPath.split(" / ") : [];

  let resolvedAuth = null;
  if (form.authType === "inherit") {
    for (let i = parts.length; i > 0; i--) {
      const path = parts.slice(0, i).join(" / ");
      const fs = fSettings[path];
      if (fs && normalizeAuthType(fs.authType, fs.authToken) !== "none") {
        resolvedAuth = fs;
        break;
      }
    }
  }

  const folderHeaderRows = [];
  for (let i = 1; i <= parts.length; i++) {
    const path = parts.slice(0, i).join(" / ");
    const fs = fSettings[path];
    if (fs?.headers?.trim()) folderHeaderRows.push(...parseHeaderRows(fs.headers));
  }

  const requestHeaderRows = Array.isArray(form.headerRows) ? form.headerRows : parseHeaderRows(form.headers || "");
  const requestHeaderNames = new Set(requestHeaderRows.filter(r => r.enabled !== false && r.name).map(r => r.name.toLowerCase()));
  const inheritedHeaders = folderHeaderRows.filter(r => r.name && !requestHeaderNames.has(r.name.toLowerCase()));

  return {
    ...form,
    authType: form.authType === "inherit" ? (resolvedAuth?.authType || "none") : form.authType,
    authToken: form.authType === "inherit" ? (resolvedAuth?.authToken || "") : form.authToken,
    authKeyName: form.authType === "inherit" ? (resolvedAuth?.authKeyName || "") : form.authKeyName,
    authKeyIn: form.authType === "inherit" ? (resolvedAuth?.authKeyIn || "header") : form.authKeyIn,
    headerRows: inheritedHeaders.length ? [...inheritedHeaders, ...requestHeaderRows] : requestHeaderRows,
  };
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

export function base64UrlEncode(bytes) {
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomBase64Url(byteCount = 32) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function formatJsonField(value, setter, announce) {
  try {
    setter(JSON.stringify(JSON.parse(value), null, 2));
    announce("JSON formatted.", "ok");
  } catch (error) {
    announce(error.message, "error");
  }
}
