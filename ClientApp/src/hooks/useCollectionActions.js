import {
  createId, normalizeFolder, buildRequest, buildAssertions, normalizeAssertions,
  inferBodyMode, parseGraphqlBody, isGraphqlEnvelope, parseParamRows, parseHeaderRows, parseFormRows,
  emptyKeyValueRows, serializeParamRows, extractUrlParams, buildBarQuery, stripUrlQuery, normalizeAuthType, parseCurlCommand,
  parseHeaders, normalizeMockPath, mockUrl, readOptionalInt,
} from "../utils.js";
import {
  importOpenApi, importPostmanCollection, exportPostmanCollection,
  importInsomniaCollection, importRequestsFromJson,
} from "../importExport.js";

export function useCollectionActions(ctx) {
  const {
    request, variables, collectionVariables, collections, collectionResults,
    mocks, curlImportText, setCurlImportText,
    bulkSelected, setBulkSelected, setBulkMoveTarget,
    profiles, activeProfileId, setActiveProfileId, setProfiles, profileNameDraft, setProfileNameDraft,
    variableDraft, setVariableDraft, variableDraftSecret, setVariableDraftSecret,
    colVarDraft, setColVarDraft, colVarDraftSecret, setColVarDraftSecret,
    mockDraft, folderSuggestions, setFolderMode,
    setCollections, setCollectionResults, setMocks,
    includedInRun, setIncludedInRun,
    openRequestTab, requestConfirm, announce,
    putItem, deleteItem, workspaceQuery, workspaceStorageKey, persist,
  } = ctx;

  // ── Request save / restore ────────────────────────────────────────────────

  function saveCurrentRequest() {
    let apiRequest, assertions;
    try {
      apiRequest = buildRequest(request, variables, false);
      assertions = buildAssertions(request.assertions);
    } catch (error) { announce(error.message, "error"); return; }
    if (!request.url.trim()) { announce("Enter a URL before saving the request.", "error"); return; }
    const name = request.name.trim() || `${apiRequest.method} ${request.url.trim()}`;
    const existing = collections.find(item => item.name.toLowerCase() === name.toLowerCase());
    function doSave() {
      const saved = {
        id: existing?.id || createId(), name,
        folder: normalizeFolder(request.folder),
        method: apiRequest.method, url: stripUrlQuery(request.url),
        params: Array.isArray(request.paramRows) ? serializeParamRows(request.paramRows) : (request.params || ""),
        headers: apiRequest.headersText,
        authType: request.authType, authToken: request.authToken.trim(),
        authKeyName: request.authKeyName.trim(), authKeyIn: request.authKeyIn || "header",
        contentType: apiRequest.contentType, body: apiRequest.body || "",
        bodyMode: request.bodyMode || inferBodyMode(request.contentType),
        assertions,
        captures: Array.isArray(request.captures) ? request.captures : [],
        preRequestScript: request.preRequestScript || "",
        postResponseScript: request.postResponseScript || "",
        description: request.description || "",
        updatedAt: new Date().toISOString(),
        timeoutMs: request.timeoutSeconds && parseFloat(request.timeoutSeconds) > 0 ? Math.round(parseFloat(request.timeoutSeconds) * 1000) : null
      };
      const nextCollections = [saved, ...collections.filter(item => item.id !== saved.id)];
      setCollections(nextCollections);
      localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify(nextCollections));
      putItem(workspaceQuery(`/api/collections/${encodeURIComponent(saved.id)}`), saved);
      announce(`Saved ${name}.`, "ok");
    }
    if (existing) { requestConfirm("save-overwrite", `Replace saved request "${name}"? Use a different request name to save a new copy.`, doSave); return; }
    doSave();
  }

  function restoreSavedRequest(item) {
    const folder = normalizeFolder(item.folder || "");
    setFolderMode(!folder ? "none" : folderSuggestions.includes(folder) ? "existing" : "new");
    const contentType = item.contentType || "application/json";
    const rawBody = item.body || "";
    let bodyMode = item.bodyMode || inferBodyMode(contentType);
    // Backward-compat: items saved before bodyMode was persisted (history entries,
    // older saved requests) store a GraphQL request as raw JSON. Recover the mode
    // by recognizing the {query, variables} envelope.
    if (bodyMode === "json" && isGraphqlEnvelope(rawBody)) bodyMode = "graphql";
    const graphqlParts = bodyMode === "graphql" ? parseGraphqlBody(rawBody) : null;
    // Query params may live inside the URL (e.g. history entries fold them in)
    // and/or in a separate `params` field (saved collection items). Pull both
    // into the editable rows so the Query params table is never blank.
    const { base: baseUrl, rows: urlParamRows } = extractUrlParams(item.url || "");
    const storedParamRows = parseParamRows(item.params || "").filter(row => row && (row.name || row.value));
    const mergedParamRows = [...urlParamRows, ...storedParamRows];
    const paramRows = mergedParamRows.length ? mergedParamRows : [{ enabled: true, name: "", value: "" }];
    // History entries carry the response that was received; rebuild it so the
    // response panel shows it without re-sending. (Saved collection items have
    // no stored response and fall through with restoredResponse = null.)
    const hasStoredResponse = item.responseStatusText != null || item.responseBody != null || Array.isArray(item.responseHeaders);
    const restoredResponse = hasStoredResponse ? {
      status: item.status,
      statusText: item.responseStatusText || "",
      durationMs: item.responseDurationMs || 0,
      headers: Array.isArray(item.responseHeaders) ? item.responseHeaders : [],
      body: item.responseBody || "",
      isBase64: item.responseIsBase64 || false
    } : null;
    openRequestTab({
      name: item.name || "", folder,
      method: item.method || "GET", url: baseUrl + buildBarQuery(paramRows),
      params: serializeParamRows(paramRows), paramRows,
      headers: item.headers || "", headerRows: parseHeaderRows(item.headers || ""),
      authType: item.authType === "inherit" ? "inherit" : normalizeAuthType(item.authType, item.authToken),
      authToken: item.authToken || "", authKeyName: item.authKeyName || "", authKeyIn: item.authKeyIn || "header",
      bodyMode, contentType,
      body: graphqlParts ? graphqlParts.query : rawBody,
      formRows: (bodyMode === "form" || bodyMode === "multipart") ? parseFormRows(rawBody) : emptyKeyValueRows(),
      graphqlVariables: graphqlParts ? graphqlParts.variables : (item.graphqlVariables || ""),
      multipartFileRows: [],
      assertions: normalizeAssertions(item.assertions),
      captures: Array.isArray(item.captures) ? item.captures.map(c => ({ ...c })) : [],
      preRequestScript: item.preRequestScript || "",
      postResponseScript: item.postResponseScript || "",
      description: item.description || "",
      timeoutSeconds: item.timeoutMs ? String(item.timeoutMs / 1000) : ""
    }, restoredResponse ? { response: restoredResponse, effectiveUrl: item.url } : {});
    announce(restoredResponse
      ? `Opened ${item.name || item.url} in a request tab with its saved response.`
      : `Opened ${item.name || item.url} in a request tab.`);
  }

  function duplicateCollectionItem(item) {
    const duplicate = { ...item, id: createId(), name: `${item.name} (copy)`, updatedAt: new Date().toISOString() };
    const idx = collections.findIndex(c => c.id === item.id);
    const nextCollections = idx >= 0
      ? [...collections.slice(0, idx + 1), duplicate, ...collections.slice(idx + 1)]
      : [duplicate, ...collections];
    setCollections(nextCollections);
    localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify(nextCollections));
    putItem(workspaceQuery(`/api/collections/${encodeURIComponent(duplicate.id)}`), duplicate);
    announce(`Duplicated "${item.name}".`, "ok");
  }

  // ── Import / export ────────────────────────────────────────────────────────

  function mergeImportedCollections(imported) {
    const collectionKey = item => `${normalizeFolder(item.folder).toLowerCase()}|${String(item.name || "").trim().toLowerCase()}`;
    const existingByName = new Map(collections.map(item => [collectionKey(item), item]));
    for (const item of imported) {
      const name = String(item.name || "").trim();
      const url = String(item.url || "").trim();
      if (!name || !url) throw new Error("Every imported request needs a name and URL.");
      const folder = normalizeFolder(item.folder);
      const existing = existingByName.get(collectionKey({ name, folder }));
      existingByName.set(collectionKey({ name, folder }), {
        ...item, id: existing?.id || item.id || createId(), name, folder, url,
        updatedAt: item.updatedAt || new Date().toISOString()
      });
    }
    persist({ collections: Array.from(existingByName.values()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
    setCollectionResults([]);
  }

  async function importCollections(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = importRequestsFromJson(JSON.parse(await file.text()));
      mergeImportedCollections(imported);
      announce(`Imported ${imported.length} saved request${imported.length === 1 ? "" : "s"}.`, "ok");
    } catch (error) { announce(error.message, "error"); }
    finally { event.target.value = ""; }
  }

  async function importOpenApiFile(event, jsyaml) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = jsyaml.load(text); }
      if (!parsed || typeof parsed !== "object") throw new Error("Could not parse file as JSON or YAML.");
      const imported = importOpenApi(parsed);
      mergeImportedCollections(imported);
      announce(`Imported ${imported.length} operation${imported.length === 1 ? "" : "s"} from OpenAPI document.`, "ok");
    } catch (error) { announce(error.message, "error"); }
    finally { event.target.value = ""; }
  }

  function importCurl() {
    try {
      mergeImportedCollections(parseCurlCommand(curlImportText));
      setCurlImportText("");
      announce("Imported cURL request.", "ok");
    } catch (error) { announce(error.message, "error"); }
  }

  function exportCollections() {
    const blob = new Blob([JSON.stringify({ app: "Accessible API Tester", version: 1, exportedAt: new Date().toISOString(), requests: collections }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "accessible-api-tester-collections.json";
    link.click();
    URL.revokeObjectURL(link.href);
    announce(`Exported ${collections.length} saved request${collections.length === 1 ? "" : "s"}.`, "ok");
  }

  function exportPostmanCollections() {
    const blob = new Blob([JSON.stringify(exportPostmanCollection(collections), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "postman-collection.json";
    link.click();
    URL.revokeObjectURL(link.href);
    announce(`Exported ${collections.length} request${collections.length === 1 ? "" : "s"} as Postman Collection v2.1.`, "ok");
  }

  function exportRunResults() {
    if (!collectionResults.length) { announce("No run results to export.", "error"); return; }
    const header = ["Name", "Method", "URL", "Result", "HTTP Status", "Duration (ms)", "Detail"];
    const rows = collectionResults.map(r => [r.name, r.method, r.url, r.status, r.statusCode ?? "", r.durationMs ?? "", r.detail]);
    const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "collection-run-results.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    announce(`Exported ${collectionResults.length} run result${collectionResults.length === 1 ? "" : "s"} as CSV.`, "ok");
  }

  function exportVariables() {
    const blob = new Blob([JSON.stringify({ app: "Accessible API Tester", version: 1, exportedAt: new Date().toISOString(), variables: variables.map(v => ({ name: v.name, value: v.value, secret: !!v.secret })) }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "accessible-api-tester-variables.json";
    link.click();
    URL.revokeObjectURL(link.href);
    announce(`Exported ${variables.length} variable${variables.length === 1 ? "" : "s"}.`, "ok");
  }

  async function importVariablesFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const raw = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.variables) ? parsed.variables : null);
      if (!raw) throw new Error("Import file must contain a variables array.");
      const normalized = raw
        .map(v => ({ id: createId(), name: String(v.name || "").trim(), value: String(v.value ?? ""), secret: !!v.secret, updatedAt: new Date().toISOString() }))
        .filter(v => /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(v.name));
      if (!normalized.length) throw new Error("No valid variable names found in the import file.");
      const byName = new Map(variables.map(v => [v.name.toLowerCase(), v]));
      for (const v of normalized) byName.set(v.name.toLowerCase(), { ...byName.get(v.name.toLowerCase()), ...v, id: byName.get(v.name.toLowerCase())?.id ?? v.id });
      persist({ environments: Array.from(byName.values()) });
      announce(`Imported ${normalized.length} variable${normalized.length === 1 ? "" : "s"}.`, "ok");
    } catch (error) { announce(error.message, "error"); }
    finally { event.target.value = ""; }
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  function toggleRunInclusion(itemId) {
    setIncludedInRun(current => {
      const next = new Set(current);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function toggleFolderInclusion(folderItems, includeAll) {
    setIncludedInRun(current => {
      const next = new Set(current);
      folderItems.forEach(item => includeAll ? next.add(item.id) : next.delete(item.id));
      return next;
    });
  }

  function deleteSelectedCollections() {
    if (!bulkSelected.size) return;
    const count = bulkSelected.size;
    const nextCollections = collections.filter(i => !bulkSelected.has(i.id));
    setCollections(nextCollections);
    localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify(nextCollections));
    [...bulkSelected].forEach(id => deleteItem(workspaceQuery(`/api/collections/${encodeURIComponent(id)}`)));
    setBulkSelected(new Set());
    announce(`Deleted ${count} request${count === 1 ? "" : "s"}.`, "ok");
  }

  function moveSelectedToFolder(folder) {
    if (!bulkSelected.size) return;
    const normalized = normalizeFolder(folder);
    const count = bulkSelected.size;
    const nextCollections = collections.map(i => bulkSelected.has(i.id) ? { ...i, folder: normalized, updatedAt: new Date().toISOString() } : i);
    setCollections(nextCollections);
    localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify(nextCollections));
    nextCollections.filter(i => bulkSelected.has(i.id)).forEach(i => putItem(workspaceQuery(`/api/collections/${encodeURIComponent(i.id)}`), i));
    setBulkSelected(new Set());
    setBulkMoveTarget("");
    announce(`Moved ${count} request${count === 1 ? "" : "s"} to ${normalized || "root"}.`, "ok");
  }

  // ── Profiles ───────────────────────────────────────────────────────────────

  function applyProfile(profile) {
    const vars = profile.variables.map(v => ({ id: createId(), name: v.name, value: v.value, updatedAt: new Date().toISOString() }));
    ctx.setVariables(vars);
    setActiveProfileId(profile.id);
    localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(vars));
    localStorage.setItem(workspaceStorageKey("activeProfile"), profile.id);
    deleteItem(workspaceQuery("/api/environments"));
    vars.forEach(v => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(v.id)}`), v));
    announce(`Applied profile "${profile.name}" — ${vars.length} variable${vars.length === 1 ? "" : "s"} loaded.`, "ok");
  }

  function saveProfile(event) {
    event.preventDefault();
    const name = profileNameDraft.trim();
    if (!name) { announce("Enter a profile name.", "error"); return; }
    if (!variables.length) { announce("Add at least one variable before saving a profile.", "error"); return; }
    const existing = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());
    const profile = { id: existing?.id || createId(), name, variables: variables.map(v => ({ name: v.name, value: v.value })) };
    const nextProfiles = [profile, ...profiles.filter(p => p.id !== profile.id)];
    setProfiles(nextProfiles);
    setActiveProfileId(profile.id);
    localStorage.setItem(workspaceStorageKey("profiles"), JSON.stringify(nextProfiles));
    localStorage.setItem(workspaceStorageKey("activeProfile"), profile.id);
    setProfileNameDraft("");
    announce(`Saved profile "${name}" with ${profile.variables.length} variable${profile.variables.length === 1 ? "" : "s"}.`, "ok");
  }

  function deleteProfile(profileId) {
    const nextProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(nextProfiles);
    localStorage.setItem(workspaceStorageKey("profiles"), JSON.stringify(nextProfiles));
    if (activeProfileId === profileId) { setActiveProfileId(null); localStorage.removeItem(workspaceStorageKey("activeProfile")); }
    announce("Profile deleted.", "ok");
  }

  // ── Variables / mocks ──────────────────────────────────────────────────────

  function saveVariable(event) {
    event.preventDefault();
    const name = variableDraft.name.trim();
    if (!name) { announce("Enter a variable name.", "error"); return; }
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) { announce("Variable names must start with a letter or underscore and use only letters, numbers, underscore, dot, or hyphen.", "error"); return; }
    const existing = variables.find(item => item.name.toLowerCase() === name.toLowerCase());
    const saved = { id: existing?.id || createId(), name, value: variableDraft.value, secret: variableDraftSecret, updatedAt: new Date().toISOString() };
    const nextVariables = [saved, ...variables.filter(item => item.id !== saved.id)];
    ctx.setVariables(nextVariables);
    localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(nextVariables));
    putItem(workspaceQuery(`/api/environments/${encodeURIComponent(saved.id)}`), saved);
    setVariableDraft({ name: "", value: "" });
    setVariableDraftSecret(false);
    announce(`Saved variable ${name}.`, "ok");
  }

  function saveCollectionVariable(event) {
    event.preventDefault();
    const name = colVarDraft.name.trim();
    if (!name) { announce("Enter a variable name.", "error"); return; }
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name)) { announce("Variable names must start with a letter or underscore and use only letters, numbers, underscore, dot, or hyphen.", "error"); return; }
    const existing = collectionVariables.find(item => item.name.toLowerCase() === name.toLowerCase());
    const saved = { id: existing?.id || createId(), name, value: colVarDraft.value, secret: colVarDraftSecret, updatedAt: new Date().toISOString() };
    const next = [saved, ...collectionVariables.filter(item => item.id !== saved.id)];
    ctx.setCollectionVariables(next);
    localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify(next));
    putItem(workspaceQuery(`/api/collection-variables/${encodeURIComponent(saved.id)}`), saved);
    setColVarDraft({ name: "", value: "" });
    setColVarDraftSecret(false);
    announce(`Saved collection variable ${name}.`, "ok");
  }

  function saveMock(event) {
    event.preventDefault();
    const name = mockDraft.name.trim();
    const path = normalizeMockPath(mockDraft.path);
    const statusCode = Number(mockDraft.statusCode);
    if (!name) { announce("Enter a mock name.", "error"); return; }
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) { announce("Mock status must be a whole number from 100 to 599.", "error"); return; }
    try { parseHeaders(mockDraft.headers); } catch (error) { announce(error.message, "error"); return; }
    let delayMs = null;
    if (mockDraft.delayMs) {
      try { delayMs = readOptionalInt(mockDraft.delayMs, "Delay", 0, 30000); }
      catch (error) { announce(error.message, "error"); return; }
    }
    const method = mockDraft.method.trim().toUpperCase();
    const existing = mocks.find(item => item.method.toUpperCase() === method && normalizeMockPath(item.path).toLowerCase() === path.toLowerCase());
    const saved = { id: existing?.id || createId(), name, method, path, statusCode, contentType: mockDraft.contentType.trim() || "application/json", headers: mockDraft.headers, body: mockDraft.body, delayMs, updatedAt: new Date().toISOString() };
    const nextMocks = [saved, ...mocks.filter(item => item.id !== saved.id)];
    setMocks(nextMocks);
    localStorage.setItem(workspaceStorageKey("mocks"), JSON.stringify(nextMocks));
    putItem(workspaceQuery(`/api/mocks/${encodeURIComponent(saved.id)}`), saved);
    announce(`Saved mock ${name}. Use ${mockUrl(saved)}.`, "ok");
  }

  return {
    saveCurrentRequest, restoreSavedRequest, duplicateCollectionItem,
    mergeImportedCollections, importCollections, importOpenApiFile, importCurl,
    exportCollections, exportPostmanCollections, exportRunResults, exportVariables,
    importVariablesFile,
    toggleRunInclusion, toggleFolderInclusion, deleteSelectedCollections, moveSelectedToFolder,
    applyProfile, saveProfile, deleteProfile,
    saveVariable, saveCollectionVariable, saveMock,
  };
}
