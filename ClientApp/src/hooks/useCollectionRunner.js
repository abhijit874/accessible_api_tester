import {
  buildRequest, buildAssertions, evaluateAssertions, runCaptures, normalizeAssertions,
  getCookiesForUrl, updateCookieJar, applyVarChangesToList, applyFolderInheritance, normalizeFolder,
} from "../utils.js";
import { runPreRequestScript, runPostResponseScript } from "../scriptEngine.js";

export function useCollectionRunner(ctx) {
  const {
    collections, variables, collectionVariables, cookieJar, cookieJarEnabled,
    folderSettings, defaultTimeout, history, mocks,
    setVariables, setCollectionVariables, setCookieJar,
    setIsRunningCollection, setCollectionResults, collectionResults,
    sendApiRequest, sendFromScript,
    putItem, workspaceQuery, workspaceStorageKey,
    announce, collectionResultsRef,
    includedInRun,
    syncStorage,
  } = ctx;

  function saveFolderSettings(nextFolderSettings) {
    ctx.setFolderSettings(nextFolderSettings);
    localStorage.setItem(workspaceStorageKey("folder-settings"), JSON.stringify(nextFolderSettings));
    syncStorage(workspaceQuery("/api/store"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history, collections, environments: variables, mocks, collectionVariables, folderSettings: nextFolderSettings })
    });
  }

  function summarizeCollection(results = collectionResults) {
    return results.reduce((summary, result) => {
      summary[result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "skipped"] += 1;
      return summary;
    }, { passed: 0, failed: 0, skipped: 0 });
  }

  async function runCollection(items = collections) {
    // Run only the ticked requests; if the user ticked none, run everything
    // passed in (all requests for the top button, a folder's requests for a
    // folder's Run button) — matching the Postman-style "Run" expectation.
    const selected = items.filter(item => includedInRun.has(item.id));
    const runnable = selected.length ? selected : items;
    if (!runnable.length) {
      announce("No saved requests to run. Save a request to this collection first.", "error");
      return;
    }
    setIsRunningCollection(true);
    setCollectionResults([]);
    const folderLabel = items.length < collections.length
      ? ` in folder "${normalizeFolder(items[0]?.folder) || "No folder"}"`
      : "";
    const skippedCount = items.length - runnable.length;
    const skippedLabel = skippedCount > 0 ? `, ${skippedCount} skipped` : "";
    announce(`Running ${runnable.length} saved request${runnable.length === 1 ? "" : "s"}${folderLabel}${skippedLabel}.`);

    const runResults = [];
    let effectiveVariables = variables;
    let effectiveCollectionVariables = collectionVariables;
    let effectiveCookieJar = cookieJar;

    const flushVariables = (next) => {
      effectiveVariables = next;
      setVariables(next);
      localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(next));
      next.forEach(v => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(v.id)}`), v));
    };
    const flushCollectionVariables = (next) => {
      effectiveCollectionVariables = next;
      setCollectionVariables(next);
      localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify(next));
      next.forEach(v => putItem(workspaceQuery(`/api/collection-variables/${encodeURIComponent(v.id)}`), v));
    };

    for (const item of runnable) {
      try {
        const form = applyFolderInheritance({ ...item, assertions: normalizeAssertions(item.assertions) }, folderSettings);

        if (item.preRequestScript?.trim()) {
          const preResult = await runPreRequestScript(item.preRequestScript, effectiveVariables, effectiveCollectionVariables, sendFromScript);
          if (Object.keys(preResult.varChanges).length)
            flushVariables(applyVarChangesToList(effectiveVariables, preResult.varChanges));
          if (Object.keys(preResult.colVarChanges).length)
            flushCollectionVariables(applyVarChangesToList(effectiveCollectionVariables, preResult.colVarChanges));
        }

        const apiRequest = buildRequest(form, effectiveVariables, true, defaultTimeout, effectiveCollectionVariables);

        let requestToSend = apiRequest;
        if (cookieJarEnabled) {
          const cookieStr = getCookiesForUrl(effectiveCookieJar, apiRequest.url);
          if (cookieStr && !apiRequest.headers.some(h => h.name.toLowerCase() === "cookie")) {
            requestToSend = { ...apiRequest, headers: [...apiRequest.headers, { name: "Cookie", value: cookieStr }] };
          }
        }

        const result = await sendApiRequest(requestToSend);

        if (cookieJarEnabled) {
          const setCookies = (result.headers || []).filter(h => h.name.toLowerCase() === "set-cookie").map(h => h.value);
          if (setCookies.length) {
            effectiveCookieJar = updateCookieJar(effectiveCookieJar, apiRequest.url, setCookies);
            setCookieJar(effectiveCookieJar);
            localStorage.setItem("accessible-api-tester-cookies", JSON.stringify(effectiveCookieJar));
          }
        }

        const assertions = buildAssertions(normalizeAssertions(item.assertions));
        const summary = evaluateAssertions(result, assertions);

        if (item.postResponseScript?.trim()) {
          const postResult = await runPostResponseScript(item.postResponseScript, effectiveVariables, effectiveCollectionVariables, result, sendFromScript);
          if (Object.keys(postResult.varChanges).length)
            flushVariables(applyVarChangesToList(effectiveVariables, postResult.varChanges));
          if (Object.keys(postResult.colVarChanges).length)
            flushCollectionVariables(applyVarChangesToList(effectiveCollectionVariables, postResult.colVarChanges));
        }

        if (Array.isArray(item.captures) && item.captures.length) {
          const captured = runCaptures(result, item.captures);
          const captureSuccesses = captured.filter(c => c.value !== null);
          if (captureSuccesses.length)
            flushVariables(applyVarChangesToList(effectiveVariables, Object.fromEntries(captureSuccesses.map(c => [c.name, c.value]))));
        }

        runResults.push({
          id: item.id, name: item.name, method: item.method, url: apiRequest.url,
          status: summary.total === 0 ? "skipped" : summary.failed.length ? "failed" : "passed",
          statusCode: result.status, durationMs: result.durationMs,
          detail: summary.total === 0 ? "No assertions configured." : summary.failed.length ? summary.failed.join(" ") : summary.message
        });
      } catch (error) {
        runResults.push({ id: item.id, name: item.name, method: item.method, url: item.url, status: "failed", statusCode: null, durationMs: null, detail: error.message });
      }
      setCollectionResults([...runResults]);
    }

    setIsRunningCollection(false);
    const summary = summarizeCollection(runResults);
    announce(`Collection run complete. ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} without assertions.`, summary.failed ? "error" : "ok");
    requestAnimationFrame(() => collectionResultsRef.current?.focus());
  }

  return { runCollection, summarizeCollection, saveFolderSettings };
}
