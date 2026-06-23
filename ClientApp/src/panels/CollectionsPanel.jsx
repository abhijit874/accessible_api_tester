import React from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileUp,
  Play,
  Plus,
  Settings,
  Trash2
} from "lucide-react";
import {
  normalizeAuthType,
  normalizeFolder,
  hasAssertions,
} from "../utils.js";
import {
  Field, IconButton, Pager,
  ConfirmPrompt, PanelList,
} from "../components.jsx";

export function CollectionsPanel({
  // data
  collections,
  setCollections,
  collectionPage,
  setCollectionPage,
  collectionQuery,
  setCollectionQuery,
  collectionTree,
  collectionResults,
  collectionSummary,
  // folder tree state
  collapsedFolders,
  setCollapsedFolders,
  folderSettings,
  editingFolderPath,
  setEditingFolderPath,
  folderSettingsDraft,
  setFolderSettingsDraft,
  saveFolderSettings,
  // run state
  isRunningCollection,
  runCollection,
  includedInRun,
  toggleRunInclusion,
  toggleFolderInclusion,
  // bulk mode
  bulkMode,
  setBulkMode,
  bulkSelected,
  setBulkSelected,
  bulkMoveTarget,
  setBulkMoveTarget,
  folderSuggestions,
  moveSelectedToFolder,
  deleteSelectedCollections,
  // actions
  exportCollections,
  exportPostmanCollections,
  exportRunResults,
  importCollections,
  importOpenApiFile,
  importCurl,
  restoreSavedRequest,
  duplicateCollectionItem,
  // curl import
  curlImportText,
  setCurlImportText,
  // refs
  fileRef,
  openApiFileRef,
  collectionResultsRef,
  // confirm
  pendingConfirm,
  requestConfirm,
  resolveConfirm,
  // announce
  announce,
  // workspace helpers
  workspaceStorageKey,
  workspaceQuery,
  deleteItem,
}) {
  return (
    <PanelList title="Collections" className="collections-panel" action={<div className="toolbar-actions"><IconButton type="button" icon={<Play />} disabled={isRunningCollection} onClick={runCollection}>Run</IconButton><IconButton type="button" icon={<Download />} onClick={exportCollections}>Export JSON</IconButton><IconButton type="button" icon={<Download />} onClick={exportPostmanCollections}>Export Postman</IconButton></div>}>
      <div className="import-row">
        <label className="file-button" htmlFor="importCollections"><FileUp aria-hidden="true" size="18" /> Import JSON / Postman / Insomnia</label>
        <input id="importCollections" ref={fileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importCollections} />
        <label className="file-button" htmlFor="importOpenApi"><FileUp aria-hidden="true" size="18" /> Import OpenAPI</label>
        <input id="importOpenApi" ref={openApiFileRef} className="visually-hidden" type="file" accept="application/json,.json,.yaml,.yml,text/yaml" onChange={importOpenApiFile} />
        <><IconButton type="button" icon={<Trash2 />} aria-label="Clear all collections" disabled={!collections.length} disabledTitle="Nothing to clear" onClick={() => requestConfirm("clear-collections", "Clear all saved requests from Collections?", () => {
            setCollections([]);
            localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify([]));
            deleteItem(workspaceQuery("/api/collections"));
          })}>Clear</IconButton><ConfirmPrompt pending={pendingConfirm} id="clear-collections" onResolve={resolveConfirm} /></>
      </div>
      <div className="curl-import">
        <Field id="curlImport" label="Import cURL"><textarea id="curlImport" className="compact-editor" value={curlImportText} onChange={event => setCurlImportText(event.target.value)} spellCheck="false" placeholder={"curl -X POST https://api.example.com/items \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"name\":\"demo\"}'"} /></Field>
        <IconButton type="button" icon={<FileUp />} onClick={importCurl}>Import cURL</IconButton>
      </div>
      <div className="search-row">
        <Field id="collectionSearch" label="Search collections"><input id="collectionSearch" value={collectionQuery} onChange={event => { setCollectionQuery(event.target.value); setCollectionPage(current => ({ ...current, skip: 0 })); }} autoComplete="off" placeholder="Search name, method, or URL" /></Field>
      </div>
      <h3 className="collection-folders-title">Requests</h3>
      {bulkMode && (
        <div className="bulk-toolbar" role="toolbar" aria-label="Bulk actions">
          <span className="bulk-count" aria-live="polite" aria-atomic="true">{bulkSelected.size} selected</span>
          <button type="button" onClick={() => setBulkSelected(new Set(collectionPage.items.map(i => i.id)))}>Select all</button>
          <button type="button" onClick={() => setBulkSelected(new Set())}>Deselect all</button>
          <label className="bulk-move-label" htmlFor="bulkMoveTarget">Move to folder:</label>
          <input id="bulkMoveTarget" className="bulk-move-input" list="folderSuggestionsBulk" value={bulkMoveTarget} onChange={e => setBulkMoveTarget(e.target.value)} placeholder="folder name or blank for root" />
          <datalist id="folderSuggestionsBulk">{folderSuggestions.map(f => <option key={f} value={f} />)}</datalist>
          <button type="button" disabled={!bulkSelected.size} onClick={() => moveSelectedToFolder(bulkMoveTarget)}>Move</button>
          <><button type="button" className="danger-button" disabled={!bulkSelected.size} onClick={() => requestConfirm("bulk-delete", `Delete ${bulkSelected.size} selected request${bulkSelected.size === 1 ? "" : "s"}?`, deleteSelectedCollections)}>Delete selected</button>
          <ConfirmPrompt pending={pendingConfirm} id="bulk-delete" onResolve={resolveConfirm} /></>
          <button type="button" onClick={() => { setBulkMode(false); setBulkSelected(new Set()); announce("Bulk selection mode exited.", "ok"); }}>Done</button>
        </div>
      )}
      {!bulkMode && (
        <div className="bulk-toggle-row">
          <button type="button" className="bulk-mode-button" onClick={() => { setBulkMode(true); announce("Bulk selection mode. Use checkboxes to select requests.", "ok"); }}>Bulk select</button>
        </div>
      )}
      {(() => {
        const getAllItems = (node) => { const all = [...node.items]; for (const c of node.children) all.push(...getAllItems(c)); return all; };
        const renderItem = (item) => (
          <li key={item.id} className="saved-row">
            {bulkMode
              ? <label className="run-toggle"><input type="checkbox" checked={bulkSelected.has(item.id)} onChange={() => setBulkSelected(cur => { const n = new Set(cur); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; })} aria-label={`Select ${item.name}`} /></label>
              : <label className="run-toggle"><input type="checkbox" checked={includedInRun.has(item.id)} onChange={() => toggleRunInclusion(item.id)} aria-label={`Include ${item.name} in collection run`} /></label>
            }
            <button type="button" onClick={() => restoreSavedRequest(item)}>{item.name} - {item.method}{normalizeAuthType(item.authType, item.authToken) === "bearer" ? " - Bearer" : ""}{hasAssertions(item.assertions) ? " - assertions" : ""}{item.description ? <span className="docs-badge" title="Has documentation" aria-label="Has documentation"> docs</span> : null}</button>
            <button type="button" aria-label={`Duplicate ${item.name}`} onClick={() => duplicateCollectionItem(item)}>Duplicate</button>
            <button type="button" className="danger-button" aria-label={`Delete saved request ${item.name}`} onClick={() => requestConfirm(`collection-${item.id}`, `Delete saved request "${item.name}"?`, () => {
                const nextCollections = collections.filter(saved => saved.id !== item.id);
                setCollections(nextCollections);
                localStorage.setItem(workspaceStorageKey("collections"), JSON.stringify(nextCollections));
                deleteItem(workspaceQuery(`/api/collections/${encodeURIComponent(item.id)}`));
              })}>Delete</button>
            <ConfirmPrompt pending={pendingConfirm} id={`collection-${item.id}`} onResolve={resolveConfirm} />
          </li>
        );
        const renderFolder = (node, depth = 0) => {
          const isCollapsed = collapsedFolders.has(node.path);
          const allItems = getAllItems(node);
          const isEditingThis = editingFolderPath === node.path;
          const currentFs = folderSettings[node.path];
          const hasAuth = currentFs && normalizeAuthType(currentFs.authType, currentFs.authToken) !== "none";
          const hasHeaders = currentFs?.headers?.trim();

          const openSettings = () => {
            setFolderSettingsDraft(currentFs || { authType: "none", authToken: "", authKeyName: "", authKeyIn: "header", headers: "" });
            setEditingFolderPath(node.path);
          };
          const closeSettings = () => { setEditingFolderPath(null); setFolderSettingsDraft({}); };
          const applySettings = () => {
            const next = { ...folderSettings };
            const isDefault = normalizeAuthType(folderSettingsDraft.authType, folderSettingsDraft.authToken) === "none" && !folderSettingsDraft.headers?.trim();
            if (isDefault) delete next[node.path]; else next[node.path] = { ...folderSettingsDraft };
            saveFolderSettings(next);
            closeSettings();
            announce(`Folder settings ${isDefault ? "cleared" : "saved"} for "${node.label}".`, "ok");
          };

          return (
            <li key={node.path} className={`collection-folder folder-depth-${depth}`}>
              <div className="folder-heading">
                <button type="button" className="folder-toggle" aria-expanded={!isCollapsed} aria-label={`${node.label} folder`}
                  onClick={() => setCollapsedFolders(cur => { const n = new Set(cur); n.has(node.path) ? n.delete(node.path) : n.add(node.path); return n; })}>
                  {isCollapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                  <span>{node.label}</span>
                  <span className="folder-count">{allItems.length}</span>
                  {(hasAuth || hasHeaders) && <span className="folder-auth-badge" aria-label="Has folder-level auth or headers">{hasAuth ? "auth" : "headers"}</span>}
                </button>
                <label className="folder-select-all">
                  <input type="checkbox" checked={allItems.length > 0 && allItems.every(i => includedInRun.has(i.id))} onChange={e => toggleFolderInclusion(allItems, e.target.checked)} aria-label={`Select all in ${node.label}`} />
                  <span>Select all</span>
                </label>
                <IconButton type="button" icon={<Play />} disabled={isRunningCollection} aria-label={`Run folder ${node.label}`} onClick={() => runCollection(allItems)}>Run</IconButton>
                <IconButton type="button" icon={<Settings />} aria-label={`${isEditingThis ? "Close" : "Edit"} settings for folder ${node.label}`} aria-expanded={isEditingThis} onClick={() => isEditingThis ? closeSettings() : openSettings()}>Auth</IconButton>
              </div>
              {isEditingThis && (
                <div className="folder-settings-panel" role="region" aria-label={`${node.label} folder settings`}>
                  <fieldset className="auth-settings">
                    <legend>Folder Auth — inherited by requests using "Inherit from folder"</legend>
                    <div className="auth-grid">
                      <Field id={`fs-authType-${node.path}`} label="Auth type">
                        <select id={`fs-authType-${node.path}`} value={folderSettingsDraft.authType || "none"}
                          onChange={e => setFolderSettingsDraft(d => ({ ...d, authType: e.target.value }))}>
                          <option value="none">No auth</option>
                          <option value="bearer">Bearer token</option>
                          <option value="basic">Basic auth</option>
                          <option value="apikey">API key</option>
                        </select>
                      </Field>
                      {folderSettingsDraft.authType === "apikey" ? (
                        <Field id={`fs-authKeyName-${node.path}`} label="Key name">
                          <input id={`fs-authKeyName-${node.path}`} value={folderSettingsDraft.authKeyName || ""}
                            onChange={e => setFolderSettingsDraft(d => ({ ...d, authKeyName: e.target.value }))}
                            autoComplete="off" placeholder="X-API-Key" />
                        </Field>
                      ) : (
                        <Field id={`fs-authToken-${node.path}`} label={folderSettingsDraft.authType === "basic" ? "Credentials" : "Token"}>
                          <input id={`fs-authToken-${node.path}`} value={folderSettingsDraft.authToken || ""}
                            onChange={e => setFolderSettingsDraft(d => ({ ...d, authToken: e.target.value }))}
                            type="password" autoComplete="off"
                            disabled={!folderSettingsDraft.authType || folderSettingsDraft.authType === "none"}
                            placeholder={folderSettingsDraft.authType === "basic" ? "username:password or {{basicCredentials}}" : "Paste token or use {{token}}"} />
                        </Field>
                      )}
                      {folderSettingsDraft.authType === "apikey" && (<>
                        <Field id={`fs-apiKeyValue-${node.path}`} label="Key value">
                          <input id={`fs-apiKeyValue-${node.path}`} value={folderSettingsDraft.authToken || ""}
                            onChange={e => setFolderSettingsDraft(d => ({ ...d, authToken: e.target.value }))}
                            type="password" autoComplete="off" placeholder="Paste key or use {{apiKey}}" />
                        </Field>
                        <Field id={`fs-authKeyIn-${node.path}`} label="Send in">
                          <select id={`fs-authKeyIn-${node.path}`} value={folderSettingsDraft.authKeyIn || "header"}
                            onChange={e => setFolderSettingsDraft(d => ({ ...d, authKeyIn: e.target.value }))}>
                            <option value="header">Header</option>
                            <option value="query">Query param</option>
                          </select>
                        </Field>
                      </>)}
                    </div>
                  </fieldset>
                  <fieldset className="headers-editor">
                    <legend>Additional Headers — added to all requests in this folder</legend>
                    <p className="field-help">One per line: <code>Name: Value</code>. Request headers with the same name take priority.</p>
                    <textarea className="folder-headers-textarea" rows={3}
                      value={folderSettingsDraft.headers || ""}
                      onChange={e => setFolderSettingsDraft(d => ({ ...d, headers: e.target.value }))}
                      placeholder={"X-Custom-Header: value\nX-Environment: staging"}
                      aria-label="Additional headers for this folder" />
                  </fieldset>
                  <div className="folder-settings-actions">
                    <IconButton type="button" className="primary" icon={<Check />} onClick={applySettings}>Apply</IconButton>
                    <button type="button" onClick={closeSettings}>Cancel</button>
                  </div>
                </div>
              )}
              {!isCollapsed && (
                <ol className="history-list folder-contents">
                  {node.items.map(renderItem)}
                  {node.children.map(child => renderFolder(child, depth + 1))}
                </ol>
              )}
            </li>
          );
        };
        const { noFolderItems, topNodes } = collectionTree;
        const hasAny = noFolderItems.length || topNodes.length;
        return hasAny ? (
          <ol className="history-list">
            {noFolderItems.map(renderItem)}
            {topNodes.map(node => renderFolder(node, 0))}
          </ol>
        ) : <p>No saved requests found.</p>;
      })()}
      <Pager page={collectionPage} onPrevious={() => setCollectionPage(current => ({ ...current, skip: Math.max(0, current.skip - current.take) }))} onNext={() => setCollectionPage(current => ({ ...current, skip: current.skip + current.take }))} />
      <section className="collection-results" aria-labelledby="collectionResultsTitle" tabIndex="-1" ref={collectionResultsRef}>
        <div className="collection-results-heading">
          <h3 id="collectionResultsTitle">Run results</h3>
          {collectionResults.length > 0 && <IconButton type="button" icon={<Download />} onClick={exportRunResults}>Export CSV</IconButton>}
        </div>
        <p>{collectionResults.length ? `${collectionSummary.passed} passed, ${collectionSummary.failed} failed, ${collectionSummary.skipped} without assertions.` : "No collection run yet."}</p>
        <ol className="history-list run-results-list">
          {collectionResults.map(result => (
            <li key={`${result.id}-${result.status}`} className={`run-result-row ${result.status === "passed" ? "result-pass" : result.status === "failed" ? "result-fail" : "result-skip"}`}
              aria-label={`${result.name}: ${result.status === "passed" ? "passed" : result.status === "failed" ? "failed" : "no assertions"}, ${result.method}${result.statusCode ? `, HTTP ${result.statusCode}` : ""}${result.durationMs != null ? `, ${result.durationMs} ms` : ""}${result.detail ? `, ${result.detail}` : ""}`}>
              <span className="run-result-badge" aria-hidden="true">{result.status === "passed" ? "✓" : result.status === "failed" ? "✗" : "–"}</span>
              <span className="run-result-name" aria-hidden="true">{result.name}</span>
              <span className="run-result-meta" aria-hidden="true">{result.method}</span>
              {result.statusCode && <span className="run-result-meta" aria-hidden="true">HTTP {result.statusCode}</span>}
              {result.durationMs != null && <span className="run-result-meta" aria-hidden="true">{result.durationMs} ms</span>}
              {result.detail && <span className="run-result-detail" aria-hidden="true">{result.detail}</span>}
            </li>
          ))}
        </ol>
      </section>
    </PanelList>
  );
}
