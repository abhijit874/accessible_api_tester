import {
  buildRequest, buildAssertions, evaluateAssertions, runCaptures, normalizeAssertions,
  inferBodyMode, fileToBase64, getCookiesForUrl, updateCookieJar, isStateChangingLocalMockRequest,
  applyVarChangesToList, createId, applyFolderInheritance, defaultAssertionSummary, extForMime,
  setStorageJson,
} from "../utils.js";
import { runPreRequestScript, runPostResponseScript, buildScriptSendResponse } from "../scriptEngine.js";

export function useSendRequest(ctx) {
  const {
    request, variables, collectionVariables, folderSettings, cookieJar, cookieJarEnabled,
    ignoreSslErrors, proxyUrl, defaultTimeout, history, collections, activeRequestTab,
    setVariables, setCollectionVariables, setCookieJar, setIsSending, setHistory,
    setActiveResponseTab, setCollections,
    updateRequestTabById, refreshMocksFromStore, putItem, workspaceQuery, workspaceStorageKey,
    announce, responsePanelRef,
  } = ctx;

  async function sendApiRequest(apiRequest) {
    const apiResponse = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...apiRequest, ignoreSslErrors, proxyUrl: proxyUrl.trim() || undefined })
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(result.message || "Request failed.");
    return result;
  }

  async function sendFromScript(spec) {
    let method = "GET", url = "", headers = [], body = "", contentType = "application/json";
    if (typeof spec === "string") {
      url = spec;
    } else {
      url = spec.url || "";
      method = (spec.method || "GET").toUpperCase();
      if (Array.isArray(spec.header)) {
        headers = spec.header.map(h => ({ name: String(h.key || h.name || "").trim(), value: String(h.value || "").trim() })).filter(h => h.name);
      } else if (spec.header && typeof spec.header === "object") {
        headers = Object.entries(spec.header).map(([name, value]) => ({ name, value: String(value || "") }));
      }
      const bodySpec = spec.body;
      if (bodySpec?.mode === "raw") {
        body = bodySpec.raw || "";
        const langMap = { json: "application/json", text: "text/plain", xml: "application/xml", html: "text/html" };
        contentType = langMap[bodySpec.options?.raw?.language] || "application/json";
      } else if (bodySpec?.mode === "urlencoded" && Array.isArray(bodySpec.urlencoded)) {
        const p = new URLSearchParams();
        bodySpec.urlencoded.filter(i => !i.disabled).forEach(i => p.append(i.key || "", i.value || ""));
        body = p.toString();
        contentType = "application/x-www-form-urlencoded";
      } else if (bodySpec?.mode === "formdata" && Array.isArray(bodySpec.formdata)) {
        const p = new URLSearchParams();
        bodySpec.formdata.filter(i => !i.disabled && i.type !== "file").forEach(i => p.append(i.key || "", i.value || ""));
        body = p.toString();
        contentType = "application/x-www-form-urlencoded";
      }
      const ctHeader = headers.find(h => h.name.toLowerCase() === "content-type");
      if (ctHeader) { contentType = ctHeader.value; }
    }
    const filteredHeaders = headers.filter(h => h.name.toLowerCase() !== "content-type");
    const apiResponse = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, url, headers: filteredHeaders, body, contentType, ignoreSslErrors, proxyUrl: proxyUrl.trim() || undefined })
    });
    const result = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(result.message || "pm.sendRequest failed.");
    return buildScriptSendResponse(result);
  }

  async function sendCurrentRequest(event) {
    event.preventDefault();
    const sendingTabId = activeRequestTab.id;

    // 1. Pre-request script
    let preLogs = [];
    let preVarChanges = {};
    let effectiveVariables = variables;
    let effectiveCollectionVariables = collectionVariables;
    if (request.preRequestScript?.trim()) {
      const preResult = await runPreRequestScript(request.preRequestScript, variables, collectionVariables, sendFromScript);
      preLogs = preResult.logs;
      preVarChanges = preResult.varChanges;
      if (Object.keys(preResult.varChanges).length) {
        effectiveVariables = applyVarChangesToList(variables, preResult.varChanges);
        setVariables(effectiveVariables);
        localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(effectiveVariables));
        effectiveVariables.forEach(v => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(v.id)}`), v));
      }
      if (Object.keys(preResult.colVarChanges).length) {
        effectiveCollectionVariables = applyVarChangesToList(collectionVariables, preResult.colVarChanges);
        setCollectionVariables(effectiveCollectionVariables);
        localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify(effectiveCollectionVariables));
        effectiveCollectionVariables.forEach(v => putItem(workspaceQuery(`/api/collection-variables/${encodeURIComponent(v.id)}`), v));
      }
    }

    // 2. Build request
    const inheritedRequest = applyFolderInheritance(request, folderSettings);
    let apiRequest, assertions;
    try {
      apiRequest = buildRequest(inheritedRequest, effectiveVariables, true, defaultTimeout, effectiveCollectionVariables);
      assertions = buildAssertions(request.assertions);
    } catch (error) {
      if (preLogs.length) {
        updateRequestTabById(sendingTabId, tab => ({ ...tab, scriptResult: { preLogs, postLogs: [], tests: [], preVarChanges, postVarChanges: {} } }));
        setActiveResponseTab("scripts");
      }
      announce(error.message, "error");
      return;
    }

    let fileFields;
    if ((request.bodyMode || inferBodyMode(request.contentType)) === "multipart") {
      const fileRows = (request.multipartFileRows || []).filter(r => r.enabled !== false && r.file);
      try {
        fileFields = await Promise.all(fileRows.map(async row => ({
          name: row.fieldName || "",
          fileName: row.file.name,
          base64Content: await fileToBase64(row.file),
          contentType: row.file.type || "application/octet-stream"
        })));
      } catch {
        announce("Could not read one or more files for upload.", "error");
        return;
      }
    }

    // Inject cookies
    let requestToSend = apiRequest;
    let injectedCookies = null;
    if (cookieJarEnabled) {
      const cookieStr = getCookiesForUrl(cookieJar, apiRequest.url);
      if (cookieStr && !apiRequest.headers.some(h => h.name.toLowerCase() === "cookie")) {
        requestToSend = { ...apiRequest, headers: [...apiRequest.headers, { name: "Cookie", value: cookieStr }] };
        injectedCookies = cookieStr;
      }
    }

    // Determine injected auth header for display
    let authInjected = null;
    if (apiRequest.authType === "bearer" || apiRequest.authType === "basic") {
      authInjected = apiRequest.headers.find(h => h.name.toLowerCase() === "authorization") || null;
    } else if (apiRequest.authType === "apikey" && (inheritedRequest.authKeyIn || "header") === "header") {
      const keyName = (inheritedRequest.authKeyName || "").trim().toLowerCase();
      if (keyName) authInjected = apiRequest.headers.find(h => h.name.toLowerCase() === keyName) || null;
    }

    setIsSending(true);
    announce(`Sending ${apiRequest.method} request.`);
    try {
      const result = await sendApiRequest(fileFields?.length ? { ...requestToSend, fileFields } : requestToSend);

      if (cookieJarEnabled) {
        const setCookies = (result.headers || []).filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
        if (setCookies.length) {
          setCookieJar(current => {
            const next = updateCookieJar(current, apiRequest.url, setCookies);
            localStorage.setItem("accessible-api-tester-cookies", JSON.stringify(next));
            return next;
          });
        }
      }

      const summary = evaluateAssertions(result, assertions);

      // 3. Post-response script
      let postLogs = [];
      let postTests = [];
      let postVarChanges = {};
      if (request.postResponseScript?.trim()) {
        const postResult = await runPostResponseScript(request.postResponseScript, effectiveVariables, effectiveCollectionVariables, result, sendFromScript);
        postLogs = postResult.logs;
        postTests = postResult.tests;
        postVarChanges = postResult.varChanges;
        if (Object.keys(postResult.varChanges).length) {
          effectiveVariables = applyVarChangesToList(effectiveVariables, postResult.varChanges);
          setVariables(effectiveVariables);
          localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(effectiveVariables));
          effectiveVariables.forEach(v => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(v.id)}`), v));
        }
        if (Object.keys(postResult.colVarChanges).length) {
          effectiveCollectionVariables = applyVarChangesToList(effectiveCollectionVariables, postResult.colVarChanges);
          setCollectionVariables(effectiveCollectionVariables);
          localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify(effectiveCollectionVariables));
          effectiveCollectionVariables.forEach(v => putItem(workspaceQuery(`/api/collection-variables/${encodeURIComponent(v.id)}`), v));
        }
      }

      // 4. History
      const historyAuthType = apiRequest.authType === "apikey" && inheritedRequest.authKeyIn === "query" ? "none" : apiRequest.authType;
      const historyItem = {
        id: createId(),
        method: apiRequest.method,
        url: apiRequest.url,
        headers: apiRequest.headersText,
        contentType: apiRequest.contentType,
        body: apiRequest.body,
        bodyMode: apiRequest.bodyMode,
        status: result.status,
        time: new Date().toISOString(),
        authType: historyAuthType,
        authToken: historyAuthType !== "none" ? apiRequest.authToken : "",
        authKeyName: historyAuthType === "apikey" ? inheritedRequest.authKeyName : "",
        authKeyIn: historyAuthType === "apikey" ? (inheritedRequest.authKeyIn || "header") : "header",
        responseStatusText: result.statusText ?? "",
        responseDurationMs: result.durationMs ?? 0,
        responseHeaders: Array.isArray(result.headers) ? result.headers : [],
        responseBody: result.body ?? "",
        responseIsBase64: result.isBase64 || false
      };
      // Every send is its own entry — do not collapse same URL+method, so a prior
      // response is never overwritten. Entries persist until explicitly cleared.
      const nextHistory = [historyItem, ...history].slice(0, 100);
      setHistory(nextHistory);
      setStorageJson(workspaceStorageKey("history"), nextHistory);
      putItem(workspaceQuery(`/api/history/${encodeURIComponent(historyItem.id)}`), historyItem);

      if (isStateChangingLocalMockRequest(apiRequest)) await refreshMocksFromStore();

      // 5. Captures
      const captured = runCaptures(result, request.captures);
      const captureSuccesses = captured.filter(c => c.value !== null);
      if (captureSuccesses.length) {
        effectiveVariables = applyVarChangesToList(effectiveVariables, Object.fromEntries(captureSuccesses.map(c => [c.name, c.value])));
        setVariables(effectiveVariables);
        localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(effectiveVariables));
        effectiveVariables.forEach(v => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(v.id)}`), v));
      }

      // 6. Update tab
      const hasScriptOutput = preLogs.length || postLogs.length || postTests.length;
      updateRequestTabById(sendingTabId, tab => ({
        ...tab,
        response: result,
        effectiveUrl: apiRequest.url,
        authInjected,
        injectedCookies,
        ignoredSsl: ignoreSslErrors,
        usedProxy: proxyUrl.trim() || null,
        timeoutMs: apiRequest.timeoutMs,
        captureResults: captured,
        assertionSummary: summary,
        scriptResult: hasScriptOutput ? { preLogs, postLogs, tests: postTests, preVarChanges, postVarChanges } : null
      }));

      // 7. Announce
      const captureNote = captureSuccesses.length ? ` Captured ${captureSuccesses.length} variable${captureSuccesses.length === 1 ? "" : "s"}.` : "";
      const testNote = postTests.length ? ` ${postTests.filter(t => t.passed).length}/${postTests.length} script tests passed.` : "";
      const hasTestFail = postTests.some(t => !t.passed);
      announce(
        `Response ${result.status} ${result.statusText}. Completed in ${result.durationMs} milliseconds.${summary.total ? ` Assertions ${summary.message}.` : ""}${captureNote}${testNote}`,
        summary.failed.length || result.status >= 400 || hasTestFail ? "error" : "ok"
      );
      if (hasScriptOutput) setActiveResponseTab("scripts");
      requestAnimationFrame(() => responsePanelRef.current?.focus());
    } catch (error) {
      updateRequestTabById(sendingTabId, tab => ({
        ...tab,
        response: { status: "Error", statusText: "", durationMs: null, headers: [], body: error.message },
        effectiveUrl: apiRequest?.url || null,
        authInjected,
        injectedCookies,
        ignoredSsl: ignoreSslErrors,
        usedProxy: proxyUrl.trim() || null,
        timeoutMs: apiRequest?.timeoutMs || null,
        captureResults: [],
        assertionSummary: defaultAssertionSummary,
        scriptResult: preLogs.length ? { preLogs, postLogs: [], tests: [], preVarChanges, postVarChanges: {} } : null
      }));
      announce(error.message, "error");
    } finally {
      setIsSending(false);
    }
  }

  function downloadResponse(response) {
    if (!response) return;
    const ctHeader = response.headers.find(h => h.name.toLowerCase() === "content-type")?.value || "";
    const mime = ctHeader.split(";")[0].trim().toLowerCase();
    const cdHeader = response.headers.find(h => h.name.toLowerCase() === "content-disposition")?.value || "";
    const cdMatch = cdHeader.match(/filename[^;=\n]*=\s*(?:['"]?)([^'";\n]+)/i);
    let filename = cdMatch?.[1]?.trim();
    if (!filename) {
      let urlPath = "";
      try { urlPath = new URL(request.url).pathname; } catch { urlPath = request.url; }
      const segment = urlPath.split("/").filter(Boolean).pop() || "response";
      filename = segment.includes(".") ? segment : segment + extForMime(mime);
    }
    let blob;
    if (response.isBase64) {
      const binary = atob(response.body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: mime || "application/octet-stream" });
    } else {
      blob = new Blob([response.body], { type: mime || "text/plain" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { sendApiRequest, sendFromScript, sendCurrentRequest, downloadResponse };
}
