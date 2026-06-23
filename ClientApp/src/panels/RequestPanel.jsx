import React from "react";
import {
  AlertTriangle,
  Bookmark,
  BookmarkX,
  Braces,
  Check,
  Code2,
  Copy,
  Database,
  Download,
  Eraser,
  Plus,
  Save,
  Search,
  Send,
  Trash2
} from "lucide-react";
import {
  METHODS,
  emptyRequest,
  inferBodyMode, bodyContentTypeForMode, parseGraphqlBody,
  parseGraphqlErrors, validateGraphqlQuery, formatGraphqlQuery,
  validateGraphqlVariables, graphqlQueryUsesVariables, graphqlDeepestClosePos,
  graphqlFieldAlreadyInBlock, graphqlRemoveFieldFromQuery,
  escapeRegex,
  parseHeaderRows, parseParamRows,
  parseFormRows,
  normalizeFolder, normalizeAuthType,
  formatBytes,
  hasAssertions,
  formatJsonField,
} from "../utils.js";
import {
  DocsSection,
  CollapsibleSection,
  Field, IconButton, Summary,
  Tabs, TabPanel, SearchableTabPanel,
  JsonTreePanel,
  ScriptPanel,
  DiffPanel, PreviewPanel,
  ConfirmPrompt,
} from "../components.jsx";

export function RequestPanel({
  // request workspace / tab state
  requestTabs,
  activeRequestTab,
  request,
  setRequest,
  setRequestWorkspace,
  closeRequestTab,
  newRequestTab,
  updateRequest,
  updateAssertion,
  addJsonpathAssertion,
  updateJsonpathAssertion,
  removeJsonpathAssertion,
  updateHeaderRow,
  removeHeaderRow,
  updateParamRow,
  removeParamRow,
  updateFormRow,
  removeFormRow,
  updateMultipartFileRow,
  removeMultipartFileRow,
  addMultipartFileRow,
  addCapture,
  updateCapture,
  removeCapture,
  // send
  sendCurrentRequest,
  isSending,
  // response state
  response,
  effectiveUrl,
  authInjected,
  injectedCookies,
  ignoredSsl,
  usedProxy,
  timeoutMs,
  captureResults,
  assertionSummary,
  scriptResult,
  responseBody,
  responseHeaders,
  rawResponse,
  activeResponseTab,
  setActiveResponseTab,
  responseSearch,
  setResponseSearch,
  responseMediaCategory,
  // actions
  downloadResponse,
  pinnedResponse,
  setPinnedResponse,
  announce,
  responsePanelRef,
  // confirm
  pendingConfirm,
  requestConfirm,
  resolveConfirm,
  // folder
  folderMode,
  setFolderMode,
  folderSuggestions,
  folderSettings,
  // snippet
  snippetOpen,
  setSnippetOpen,
  snippetLanguage,
  setSnippetLanguage,
  snippetData,
  copySnippet,
  // graphql
  graphqlSchema,
  graphqlSchemaError,
  graphqlSchemaLoading,
  fetchGraphqlSchema,
  clearGraphqlSchema,
  // ssl/proxy
  ignoreSslErrors,
  setIgnoreSslErrors,
  proxyUrl,
  setProxyUrl,
  // tab utilities
  requestTabTitle,
  requestTabCloseLabel,
  requestTabAriaLabel,
  // isRequestEmpty
  isRequestEmpty,
  saveCurrentRequest,
}) {
  const graphqlQueryRef = React.useRef(null);
  // Last caret position the user actually placed in the query box. Null until
  // they click/type there, so a field click with no caret appends at the end
  // rather than jamming the field at position 0.
  const graphqlCaretRef = React.useRef(null);
  const graphqlMode = (request.bodyMode || inferBodyMode(request.contentType)) === "graphql";
  const graphqlValidationError = graphqlMode ? validateGraphqlQuery(request.body) : null;
  const graphqlVarsError = graphqlMode ? validateGraphqlVariables(request.graphqlVariables) : null;
  const graphqlVarsIgnored = graphqlMode && !graphqlQueryUsesVariables(request.body) && String(request.graphqlVariables || "").trim();
  const isGraphqlUrl = /\/graphql\b/i.test(request.url || "");
  const graphqlErrors = (graphqlMode || isGraphqlUrl) && response && !response.isBase64 ? parseGraphqlErrors(response.body) : null;

  // Inserts a field into the GraphQL query. If the user placed a caret, insert
  // there (space-padded so tokens never fuse, e.g. avoids "emojiquery"). If they
  // haven't, drop it on its own line inside the deepest selection set so it lands
  // inside the block being built rather than outside the query.
  function insertIntoQuery(text) {
    const el = graphqlQueryRef.current;
    const current = request.body || "";
    const tracked = graphqlCaretRef.current;
    let next, caret;

    // Reject a duplicate field within the same selection block (invalid GraphQL),
    // but allow the same field name in a different block.
    const targetIndex = tracked ? Math.max(0, Math.min(tracked.start, current.length)) : graphqlDeepestClosePos(current);
    if (targetIndex >= 0 && graphqlFieldAlreadyInBlock(current, targetIndex, text)) {
      announce(`${text} is already in this selection block — not inserted again.`, "error");
      return;
    }

    if (!tracked) {
      const closePos = graphqlDeepestClosePos(current);
      if (closePos >= 0) {
        const before = current.slice(0, closePos);
        const after = current.slice(closePos); // begins with the closing "}"
        const closeIndent = (before.match(/[ \t]*$/) || [""])[0];
        const beforeTrimmed = before.slice(0, before.length - closeIndent.length);
        const fieldIndent = `${closeIndent}  `;
        const sep = beforeTrimmed === "" || beforeTrimmed.endsWith("\n") ? "" : "\n";
        const inserted = `${sep}${fieldIndent}${text}\n${closeIndent}`;
        next = beforeTrimmed + inserted + after;
        caret = (beforeTrimmed + sep + fieldIndent + text).length;
      } else {
        // No selection set yet — append, space-separated.
        const sep = current && !/\s$/.test(current) ? " " : "";
        next = current + sep + text;
        caret = next.length;
      }
    } else {
      let start = Math.max(0, Math.min(tracked.start, current.length));
      let end = Math.max(start, Math.min(tracked.end, current.length));
      const before = current.slice(0, start);
      const after = current.slice(end);
      const needsLeadingSpace = before && !/\s$/.test(before) && !/[{(\[]$/.test(before);
      const needsTrailingSpace = after && !/^\s/.test(after) && !/^[)}\]]/.test(after);
      const insert = `${needsLeadingSpace ? " " : ""}${text}${needsTrailingSpace ? " " : ""}`;
      next = before + insert + after;
      caret = start + insert.length;
    }

    updateRequest("body", next);
    graphqlCaretRef.current = { start: caret, end: caret };
    announce(`Inserted ${text} into the GraphQL query.`, "ok");
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(caret, caret);
      });
    }
  }

  // Removes a previously-inserted field (and any sub-selection it carries) from
  // the query. Caret tracking is reset since positions shift.
  function removeFromQuery(text) {
    const current = request.body || "";
    const next = graphqlRemoveFieldFromQuery(current, text);
    if (next === current) { announce(`${text} is not in the query.`, "error"); return; }
    updateRequest("body", next);
    graphqlCaretRef.current = null;
    announce(`Removed ${text} from the GraphQL query.`, "ok");
  }

  function formatGraphql() {
    const error = validateGraphqlQuery(request.body);
    if (error) { announce(`Cannot format: ${error}`, "error"); return; }
    updateRequest("body", formatGraphqlQuery(request.body));
    announce("GraphQL query formatted.", "ok");
  }

  return (
    <>
      <section className="panel request-panel" aria-labelledby="requestTitle">
      <h2 id="requestTitle">Request</h2>
      <div className="request-tabs" role="tablist" aria-label="Open requests">
        {requestTabs.map(tab => (
          <div
            key={tab.id}
            role="presentation"
            className={tab.id === activeRequestTab.id ? "request-tab active-request-tab" : "request-tab"}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === activeRequestTab.id}
              aria-label={requestTabAriaLabel(tab)}
              onClick={() => setRequestWorkspace(current => ({ ...current, activeId: tab.id }))}
            >
              <span>{requestTabTitle(tab)}</span>
              <span className="request-tab-method">{tab.request.method || "GET"}</span>
              {tab.id === activeRequestTab.id && <span className="current-tab-marker">Current</span>}
            </button>
            <button type="button" aria-label={requestTabCloseLabel(tab)} className="request-tab-close" onClick={() => closeRequestTab(tab.id)}>Close</button>
          </div>
        ))}
        <IconButton type="button" icon={<Plus />} onClick={newRequestTab}>New tab</IconButton>
      </div>
      <form aria-labelledby="requestTitle" onSubmit={sendCurrentRequest} onKeyDown={event => { if (event.key === "Enter" && event.target.tagName === "INPUT" && event.target.type !== "submit") event.preventDefault(); }}>
        <div className="save-request">
          <Field id="requestName" label="Request name">
            <input id="requestName" value={request.name} onChange={event => updateRequest("name", event.target.value)} autoComplete="off" placeholder="Example: Create post" />
          </Field>
          <div className="folder-selection" role="group" aria-labelledby="folderGroupLabel">
            <span id="folderGroupLabel" className="folder-group-label">Folder</span>
            <div className="folder-radio-group">
              <label className="folder-radio-label">
                <input
                  type="radio"
                  name="folderMode"
                  value="none"
                  checked={folderMode === "none"}
                  onChange={() => { setFolderMode("none"); updateRequest("folder", ""); }}
                />
                No folder
              </label>
              <label className="folder-radio-label">
                <input
                  type="radio"
                  name="folderMode"
                  value="new"
                  checked={folderMode === "new"}
                  onChange={() => setFolderMode("new")}
                />
                New folder
              </label>
              <label className="folder-radio-label">
                <input
                  type="radio"
                  name="folderMode"
                  value="existing"
                  checked={folderMode === "existing"}
                  disabled={folderSuggestions.length === 0}
                  onChange={() => setFolderMode("existing")}
                />
                Existing folder
              </label>
            </div>
            {folderMode === "new" && (
              <input
                id="requestFolder"
                value={request.folder}
                onChange={event => updateRequest("folder", event.target.value)}
                autoComplete="off"
                placeholder="Type new folder name"
                aria-label="Folder name"
              />
            )}
            {folderMode === "existing" && (
              <select
                id="requestFolder"
                value={request.folder}
                onChange={event => updateRequest("folder", event.target.value)}
                aria-label="Existing folder"
              >
                <option value="">-- Select folder --</option>
                {folderSuggestions.map(folder => <option key={folder} value={folder}>{folder}</option>)}
              </select>
            )}
          </div>
          <IconButton type="button" icon={<Plus />} onClick={newRequestTab}>New request</IconButton>
          <IconButton type="button" icon={<Save />} onClick={saveCurrentRequest}>Save</IconButton>
          <ConfirmPrompt pending={pendingConfirm} id="save-overwrite" onResolve={resolveConfirm} />
        </div>

        <div className="request-line">
          <Field id="method" label="Method">
            <select id="method" value={request.method} onChange={event => updateRequest("method", event.target.value)}>{METHODS.map(method => <option key={method}>{method}</option>)}</select>
          </Field>
          <Field id="url" label="URL">
            <input
              id="url"
              value={request.url}
              onChange={event => updateRequest("url", event.target.value)}
              onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              required
              aria-required="true"
              aria-describedby="url-hint"
              placeholder="https://api.example.com/resource or {{baseUrl}}/resource"
            />
          </Field>
          <p id="url-hint" className="visually-hidden">Enter the API endpoint URL. Query parameters are synced automatically. URLs containing /graphql will auto-switch the method to POST and body mode to GraphQL. Use the Send button to send the request.</p>
          <Field id="requestTimeout" label="Timeout (s)" className="timeout-field">
            <input id="requestTimeout" type="number" inputMode="numeric" min="1" value={request.timeoutSeconds} onChange={event => updateRequest("timeoutSeconds", event.target.value)} placeholder="60" />
          </Field>
          <IconButton className="primary" disabled={isSending} icon={<Send />}>{isSending ? "Sending" : "Send"}</IconButton>
        </div>

        <fieldset className="params-editor">
          <legend><h3 className="section-heading">Query params</h3></legend>
          <div className="header-grid header-grid-heading" aria-hidden="true">
            <span>Use</span>
            <span>Param</span>
            <span>Value</span>
            <span>Action</span>
          </div>
          {(Array.isArray(request.paramRows) && request.paramRows.length ? request.paramRows : parseParamRows(request.params)).map((row, index) => (
            <div className="header-grid" key={index}>
              <label className="header-toggle">
                <input type="checkbox" checked={row.enabled !== false} onChange={event => updateParamRow(index, "enabled", event.target.checked)} />
                <span className="visually-hidden">{`Use query param row ${index + 1}`}</span>
              </label>
              <input value={row.name} onChange={event => updateParamRow(index, "name", event.target.value)} autoComplete="off" placeholder="page" aria-label={`Query param ${index + 1} name`} />
              <input value={row.value} onChange={event => updateParamRow(index, "value", event.target.value)} autoComplete="off" placeholder="1 or {{pageNum}}" aria-label={`Query param ${index + 1} value`} />
              <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete query param row ${index + 1}`} onClick={() => removeParamRow(index)}>Delete</IconButton>
            </div>
          ))}
        </fieldset>

        <fieldset className="headers-editor">
          <legend><h3 className="section-heading">Headers</h3></legend>
          <div className="header-grid header-grid-heading" aria-hidden="true">
            <span>Use</span>
            <span>Header</span>
            <span>Value</span>
            <span>Action</span>
          </div>
          {(Array.isArray(request.headerRows) && request.headerRows.length ? request.headerRows : parseHeaderRows(request.headers)).map((row, index) => (
            <div className="header-grid" key={index}>
              <label className="header-toggle">
                <input type="checkbox" checked={row.enabled !== false} onChange={event => updateHeaderRow(index, "enabled", event.target.checked)} />
                <span className="visually-hidden">{`Use header row ${index + 1}`}</span>
              </label>
              <input value={row.name} onChange={event => updateHeaderRow(index, "name", event.target.value)} autoComplete="off" placeholder="Accept" aria-label={`Header ${index + 1} name`} />
              <input value={row.value} onChange={event => updateHeaderRow(index, "value", event.target.value)} autoComplete="off" placeholder="application/json or {{token}}" aria-label={`Header ${index + 1} value`} />
              <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete header row ${index + 1}`} onClick={() => removeHeaderRow(index)}>Delete</IconButton>
            </div>
          ))}
        </fieldset>

        <fieldset className="auth-settings">
          <legend><h3 className="section-heading">Authorization</h3></legend>
          <div className="auth-grid">
            <Field id="authType" label="Auth type" helpId="authTokenHelp">
              <select id="authType" value={request.authType} aria-describedby="authTokenHelp" onChange={event => updateRequest("authType", event.target.value)}>
                <option value="none">No auth</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
                <option value="apikey">API key</option>
                <option value="inherit">Inherit from folder</option>
              </select>
            </Field>
            {request.authType !== "inherit" && request.authType === "apikey" ? (
              <Field id="authKeyName" label="Key name">
                <input id="authKeyName" value={request.authKeyName} onChange={event => updateRequest("authKeyName", event.target.value)} autoComplete="off" placeholder="X-API-Key or api_key" />
              </Field>
            ) : request.authType !== "inherit" ? (
              <Field id="authToken" label={request.authType === "basic" ? "Credentials" : "Token"} helpId="authTokenHelp">
                <input id="authToken" value={request.authToken} onChange={event => updateRequest("authToken", event.target.value)} type="password" autoComplete="off" disabled={request.authType === "none"} placeholder={request.authType === "basic" ? "username:password or {{basicCredentials}}" : "Paste token or use {{token}}"} />
              </Field>
            ) : null}
            {request.authType === "apikey" && (<>
              <Field id="authToken" label="Key value">
                <input id="authToken" value={request.authToken} onChange={event => updateRequest("authToken", event.target.value)} type="password" autoComplete="off" placeholder="Paste key or use {{apiKey}}" />
              </Field>
              <Field id="authKeyIn" label="Send in">
                <select id="authKeyIn" value={request.authKeyIn || "header"} onChange={event => updateRequest("authKeyIn", event.target.value)}>
                  <option value="header">Header</option>
                  <option value="query">Query param</option>
                </select>
              </Field>
            </>)}
          </div>
          <p id="authTokenHelp" className="field-help">
            {request.authType === "inherit"
              ? (() => {
                  const parts = normalizeFolder(request.folder || "").split(" / ").filter(Boolean);
                  for (let i = parts.length; i > 0; i--) {
                    const path = parts.slice(0, i).join(" / ");
                    const fs = folderSettings[path];
                    if (fs && normalizeAuthType(fs.authType, fs.authToken) !== "none") {
                      const label = fs.authType === "bearer" ? "Bearer token" : fs.authType === "basic" ? "Basic auth" : `API key (${(fs.authKeyIn || "header") === "query" ? "query param" : "header"})`;
                      return `Inheriting ${label} from folder "${path}".`;
                    }
                  }
                  return request.folder ? "No folder auth found — request will use No auth." : "Save the request to a folder, then configure auth on that folder.";
                })()
              : request.authType === "apikey"
                ? "API key sends the key name and value as a request header or query param."
                : "Bearer adds Authorization: Bearer. Basic expects username:password and sends Authorization: Basic."}
          </p>
        </fieldset>

        {!["GET", "HEAD", "OPTIONS"].includes(request.method) && (
        <fieldset className="body-settings">
          <legend><h3 className="section-heading">Body</h3></legend>
          <div className="body-mode-grid">
            <Field id="bodyMode" label="Body mode">
              <select id="bodyMode" value={request.bodyMode || inferBodyMode(request.contentType)} onChange={event => {
                const mode = event.target.value;
                setRequest(current => ({
                  ...current,
                  bodyMode: mode,
                  contentType: bodyContentTypeForMode(mode, current.contentType),
                  formRows: (mode === "form" || mode === "multipart") ? parseFormRows(current.body) : current.formRows
                }));
              }}>
                <option value="json">Raw JSON</option>
                <option value="text">Raw text</option>
                <option value="graphql">GraphQL</option>
                <option value="form">x-www-form-urlencoded</option>
                <option value="multipart">multipart/form-data</option>
              </select>
            </Field>
            <Field id="contentType" label="Body content type">
              <input id="contentType" value={bodyContentTypeForMode(request.bodyMode, request.contentType)} onChange={event => updateRequest("contentType", event.target.value)} disabled={["form", "multipart", "text", "graphql"].includes(request.bodyMode)} />
            </Field>
          </div>
          {(request.bodyMode || inferBodyMode(request.contentType)) === "form" ? (
            <div className="form-body-editor">
              <div className="form-grid form-grid-heading" aria-hidden="true">
                <span>Use</span>
                <span>Field</span>
                <span>Value</span>
                <span>Action</span>
              </div>
              {(Array.isArray(request.formRows) && request.formRows.length ? request.formRows : parseFormRows(request.body)).map((row, index) => (
                <div className="form-grid" key={index}>
                  <label className="header-toggle">
                    <input type="checkbox" checked={row.enabled !== false} onChange={event => updateFormRow(index, "enabled", event.target.checked)} />
                    <span className="visually-hidden">{`Use form field row ${index + 1}`}</span>
                  </label>
                  <input value={row.name} onChange={event => updateFormRow(index, "name", event.target.value)} autoComplete="off" placeholder="user[token]" aria-label={`Form field ${index + 1} name`} />
                  <input value={row.value} onChange={event => updateFormRow(index, "value", event.target.value)} autoComplete="off" placeholder="{{providesk_auth_token}}" aria-label={`Form field ${index + 1} value`} />
                  <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete form field row ${index + 1}`} onClick={() => removeFormRow(index)}>Delete</IconButton>
                </div>
              ))}
            </div>
          ) : (request.bodyMode || inferBodyMode(request.contentType)) === "multipart" ? (
            <div className="form-body-editor">
              <p className="field-help">Text fields are sent as form parts. File fields attach binary files from your device.</p>
              <div className="form-grid form-grid-heading" aria-hidden="true">
                <span>Use</span>
                <span>Field</span>
                <span>Value</span>
                <span>Action</span>
              </div>
              {(Array.isArray(request.formRows) && request.formRows.length ? request.formRows : parseFormRows(request.body)).map((row, index) => (
                <div className="form-grid" key={index}>
                  <label className="header-toggle">
                    <input type="checkbox" checked={row.enabled !== false} onChange={event => updateFormRow(index, "enabled", event.target.checked)} />
                    <span className="visually-hidden">{`Use text field row ${index + 1}`}</span>
                  </label>
                  <input value={row.name} onChange={event => updateFormRow(index, "name", event.target.value)} autoComplete="off" placeholder="field_name" aria-label={`Text field ${index + 1} name`} />
                  <input value={row.value} onChange={event => updateFormRow(index, "value", event.target.value)} autoComplete="off" placeholder="value" aria-label={`Text field ${index + 1} value`} />
                  <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete text field row ${index + 1}`} onClick={() => removeFormRow(index)}>Delete</IconButton>
                </div>
              ))}
              <p className="field-help multipart-file-heading">File fields</p>
              {(request.multipartFileRows || []).map((row, index) => (
                <div className="multipart-file-row" key={row.id || index}>
                  <label className="header-toggle">
                    <input type="checkbox" checked={row.enabled !== false} onChange={event => updateMultipartFileRow(index, "enabled", event.target.checked)} />
                    <span className="visually-hidden">{`Use file field row ${index + 1}`}</span>
                  </label>
                  <input value={row.fieldName || ""} onChange={event => updateMultipartFileRow(index, "fieldName", event.target.value)} autoComplete="off" placeholder="file" aria-label={`File field ${index + 1} name`} className="multipart-field-name" />
                  <label className="multipart-file-label">
                    <span className="visually-hidden">{`File for field ${index + 1}: ${row.file ? row.file.name : "no file chosen"}`}</span>
                    <input type="file" className="visually-hidden" aria-label={`Choose file for field ${index + 1}`} onChange={event => updateMultipartFileRow(index, "file", event.target.files?.[0] || null)} />
                    <span className="multipart-file-name" aria-hidden="true">{row.file ? row.file.name : "Choose file…"}</span>
                  </label>
                  <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete file field row ${index + 1}`} onClick={() => removeMultipartFileRow(index)}>Delete</IconButton>
                </div>
              ))}
              <IconButton type="button" icon={<Plus />} onClick={addMultipartFileRow}>Add file field</IconButton>
            </div>
          ) : (request.bodyMode || inferBodyMode(request.contentType)) === "graphql" ? (
            <div className="graphql-editor">
              <div className="graphql-toolbar">
                <IconButton type="button" icon={<Braces />} onClick={formatGraphql}>Format query</IconButton>
                <IconButton type="button" icon={<Database />} disabled={graphqlSchemaLoading} onClick={fetchGraphqlSchema}>{graphqlSchemaLoading ? "Loading schema…" : "Fetch schema"}</IconButton>
                {graphqlSchema && <IconButton type="button" icon={<Trash2 />} onClick={clearGraphqlSchema}>Hide schema</IconButton>}
              </div>
              <Field id="graphqlQuery" label="GraphQL query">
                <textarea ref={graphqlQueryRef} id="graphqlQuery" className="body-editor" value={request.body} onChange={event => updateRequest("body", event.target.value)} onSelect={event => { graphqlCaretRef.current = { start: event.target.selectionStart, end: event.target.selectionEnd }; }} spellCheck="false" placeholder={"query {\n  users {\n    id\n    name\n  }\n}"} aria-label="GraphQL query" aria-describedby="graphqlValidation" />
              </Field>
              <p id="graphqlValidation" className={`graphql-validation${graphqlValidationError ? " graphql-validation-error" : " graphql-validation-ok"}`} role={graphqlValidationError ? "alert" : undefined}>
                {graphqlValidationError
                  ? <><AlertTriangle size={14} aria-hidden="true" /> {graphqlValidationError}</>
                  : request.body?.trim() ? <><Check size={14} aria-hidden="true" /> Query structure looks valid.</> : null}
              </p>
              <Field id="graphqlVariables" label="Variables (JSON)">
                <textarea id="graphqlVariables" className="body-editor graphql-vars" value={request.graphqlVariables || ""} onChange={event => updateRequest("graphqlVariables", event.target.value)} spellCheck="false" placeholder={"{\n  \"id\": 1\n}"} aria-label="GraphQL variables JSON" aria-describedby="graphqlVarsValidation" />
              </Field>
              <p id="graphqlVarsValidation" className={`graphql-validation${graphqlVarsError ? " graphql-validation-error" : " graphql-validation-ok"}`} role={graphqlVarsError ? "alert" : undefined}>
                {graphqlVarsError
                  ? <><AlertTriangle size={14} aria-hidden="true" /> {graphqlVarsError}{graphqlVarsIgnored ? " (query uses no variables, so this is ignored)" : ""}</>
                  : graphqlVarsIgnored ? <>Query uses no variables — this box is ignored.</>
                  : String(request.graphqlVariables || "").trim() ? <><Check size={14} aria-hidden="true" /> Variables look valid.</> : null}
              </p>
              {graphqlSchemaError && <p className="graphql-schema-error" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {graphqlSchemaError}</p>}
              {graphqlSchema && (
                <details className="graphql-schema" open>
                  <summary>Schema explorer — {graphqlSchema.types.length} types from <span className="mono">{graphqlSchema.url}</span></summary>
                  <p className="field-help">
                    Roots:
                    {graphqlSchema.rootNames.query && <> query <span className="mono">{graphqlSchema.rootNames.query}</span></>}
                    {graphqlSchema.rootNames.mutation && <> · mutation <span className="mono">{graphqlSchema.rootNames.mutation}</span></>}
                    {graphqlSchema.rootNames.subscription && <> · subscription <span className="mono">{graphqlSchema.rootNames.subscription}</span></>}
                    . Click a field name to insert it into the query at the cursor.
                  </p>
                  <div className="graphql-type-list">
                    {graphqlSchema.types.map(type => (
                      <details className="graphql-type" key={type.name}>
                        <summary><span className="graphql-type-kind">{type.kind}</span> <span className="mono">{type.name}</span></summary>
                        {type.description && <p className="graphql-type-desc">{type.description}</p>}
                        {type.fields.length > 0 && (
                          <ul className="graphql-field-list">
                            {type.fields.map(field => {
                              const inQuery = new RegExp(`\\b${escapeRegex(field.name)}\\b`).test(request.body || "");
                              return (
                              <li key={field.name}>
                                <button
                                  type="button"
                                  className={`graphql-field-insert mono${inQuery ? " graphql-field-in-query" : ""}`}
                                  onClick={() => insertIntoQuery(field.name)}
                                  aria-pressed={inQuery}
                                  aria-label={inQuery ? `Insert field ${field.name} into query, currently in query` : `Insert field ${field.name} into query`}
                                >{field.name}</button>
                                {field.args.length > 0 && <span className="graphql-field-args mono">({field.args.map(a => `${a.name}: ${a.type}`).join(", ")})</span>}
                                <span className="graphql-field-type mono">: {field.type}</span>
                                {inQuery && <span className="graphql-field-status" aria-hidden="true">✓ in query</span>}
                                <button
                                  type="button"
                                  className="graphql-field-remove"
                                  onClick={() => removeFromQuery(field.name)}
                                  disabled={!inQuery}
                                  aria-label={inQuery ? `Remove field ${field.name} from query` : `Remove field ${field.name} from query (not inserted)`}
                                  title={inQuery ? `Remove ${field.name}` : `${field.name} is not in the query`}
                                >✕</button>
                              </li>
                              );
                            })}
                          </ul>
                        )}
                        {type.enumValues.length > 0 && (
                          <p className="graphql-enum mono">{type.enumValues.join(" | ")}</p>
                        )}
                      </details>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <Field id="body" label={(request.bodyMode || inferBodyMode(request.contentType)) === "text" ? "Raw text" : "Raw JSON"}>
              <textarea id="body" className="body-editor" value={request.body} onChange={event => updateRequest("body", event.target.value)} spellCheck="false" placeholder={(request.bodyMode || inferBodyMode(request.contentType)) === "text" ? "Plain text body" : '{\n  "name": "example"\n}'} />
            </Field>
          )}
        </fieldset>
        )}

        <CollapsibleSection className="assertions" id="assertions" title="Assertions" description="Define pass/fail checks on the response: expected status, max time, body contains, body regex, header name and value, and JSONPath rules.">

          <div className="assertion-grid">
            <Field id="expectedStatus" label="Expected status"><input id="expectedStatus" type="number" inputMode="numeric" min="100" max="599" value={request.assertions.statusCode} onChange={event => updateAssertion("statusCode", event.target.value)} placeholder="200" /></Field>
            <Field id="maxDurationMs" label="Max time (ms)"><input id="maxDurationMs" type="number" inputMode="numeric" min="1" value={request.assertions.maxDurationMs} onChange={event => updateAssertion("maxDurationMs", event.target.value)} placeholder="1000" /></Field>
            <Field id="expectedBodyContains" label="Body contains" className="assertion-wide"><input id="expectedBodyContains" value={request.assertions.bodyContains} onChange={event => updateAssertion("bodyContains", event.target.value)} autoComplete="off" placeholder='"success"' /></Field>
            <Field id="expectedBodyRegex" label="Body matches regex" className="assertion-wide"><input id="expectedBodyRegex" value={request.assertions.bodyMatchesRegex} onChange={event => updateAssertion("bodyMatchesRegex", event.target.value)} autoComplete="off" spellCheck="false" placeholder="^{&quot;ok&quot;:true}" /></Field>
            <Field id="expectedHeaderName" label="Header name"><input id="expectedHeaderName" value={request.assertions.headerName} onChange={event => updateAssertion("headerName", event.target.value)} autoComplete="off" placeholder="Content-Type" /></Field>
            <Field id="expectedHeaderValue" label="Header value contains"><input id="expectedHeaderValue" value={request.assertions.headerValue} onChange={event => updateAssertion("headerValue", event.target.value)} autoComplete="off" placeholder="application/json" /></Field>
          </div>
          {(Array.isArray(request.assertions.jsonpathAssertions) && request.assertions.jsonpathAssertions.length > 0) && (
            <div className="jsonpath-grid jsonpath-grid-heading" aria-hidden="true">
              <span>JSONPath</span>
              <span>Operator</span>
              <span>Expected value</span>
              <span>Action</span>
            </div>
          )}
          {(Array.isArray(request.assertions.jsonpathAssertions) ? request.assertions.jsonpathAssertions : []).map((ja, index) => {
            const noValue = ja.operator === "exists" || ja.operator === "notExists";
            return (
              <div className="jsonpath-grid" key={ja.id || index}>
                <input
                  value={ja.path}
                  onChange={e => updateJsonpathAssertion(index, "path", e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="$.data.status"
                  aria-label={`JSONPath assertion ${index + 1} path`}
                />
                <select
                  value={ja.operator}
                  onChange={e => updateJsonpathAssertion(index, "operator", e.target.value)}
                  aria-label={`JSONPath assertion ${index + 1} operator`}
                >
                  <option value="equals">equals</option>
                  <option value="notEquals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="matches">matches regex</option>
                  <option value="exists">exists</option>
                  <option value="notExists">not exists</option>
                  <option value="gt">{">"} greater than</option>
                  <option value="lt">{"<"} less than</option>
                  <option value="gte">{"≥"} at least</option>
                  <option value="lte">{"≤"} at most</option>
                  <option value="lengthEquals">length =</option>
                  <option value="lengthGt">length {">"}</option>
                  <option value="lengthLt">length {"<"}</option>
                </select>
                <input
                  value={ja.expected}
                  onChange={e => updateJsonpathAssertion(index, "expected", e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder={noValue ? "(no value needed)" : ja.operator === "matches" ? "^active$" : "active"}
                  disabled={noValue}
                  aria-label={`JSONPath assertion ${index + 1} expected value`}
                />
                <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete JSONPath assertion ${index + 1}`} onClick={() => removeJsonpathAssertion(index)}>Delete</IconButton>
              </div>
            );
          })}
          <IconButton type="button" icon={<Plus />} onClick={addJsonpathAssertion}>Add JSONPath assertion</IconButton>
        </CollapsibleSection>

        <CollapsibleSection className="captures-editor" id="captures" title="Captures" description="Save response values into variables after the request, taken from the JSON body, a response header, or the status code.">

          <p className="field-help">Save response values into variables after each request. Use dot notation for JSON paths, e.g. <code>data.token</code> or <code>items[0].id</code>.</p>
          {(Array.isArray(request.captures) && request.captures.length > 0) && (
            <div className="capture-grid capture-grid-heading" aria-hidden="true">
              <span>Variable</span>
              <span>From</span>
              <span>Path / name</span>
              <span>Action</span>
            </div>
          )}
          {(Array.isArray(request.captures) ? request.captures : []).map((capture, index) => (
            <div className="capture-grid" key={capture.id || index}>
              <input
                value={capture.variableName}
                onChange={event => updateCapture(index, "variableName", event.target.value)}
                autoComplete="off"
                placeholder="token"
                aria-label={`Capture ${index + 1} variable name`}
              />
              <select
                value={capture.source}
                onChange={event => updateCapture(index, "source", event.target.value)}
                aria-label={`Capture ${index + 1} source`}
              >
                <option value="body">Body (JSON)</option>
                <option value="header">Header</option>
                <option value="status">Status code</option>
              </select>
              <input
                value={capture.path}
                onChange={event => updateCapture(index, "path", event.target.value)}
                autoComplete="off"
                placeholder={capture.source === "header" ? "Content-Type" : capture.source === "status" ? "(not needed)" : "data.token"}
                disabled={capture.source === "status"}
                aria-label={`Capture ${index + 1} ${capture.source === "header" ? "header name" : "JSON path"}`}
              />
              <IconButton type="button" className="danger-button" icon={<Trash2 />} aria-label={`Delete capture ${index + 1}`} onClick={() => removeCapture(index)}>Delete</IconButton>
            </div>
          ))}
          <IconButton type="button" icon={<Plus />} onClick={addCapture}>Add capture</IconButton>
        </CollapsibleSection>

        <DocsSection description={request.description || ""} onChange={value => updateRequest("description", value)} />

        <CollapsibleSection className="script-editor" id="pre-request-script" title="Pre-request script" description="JavaScript that runs before the request is sent, to set variables or fetch a token first.">

          <p className="field-help">
            Runs before the request is sent. Use <code>pm.environment.set("name", value)</code> to set variables,
            or <code>await pm.sendRequest(…)</code> to fetch a token first. Output appears in the Scripts response tab.
          </p>
          <textarea
            className="script-textarea"
            value={request.preRequestScript || ""}
            onChange={event => updateRequest("preRequestScript", event.target.value)}
            spellCheck="false"
            aria-label="Pre-request script"
            placeholder={"// Fetch a token before the request:\n// const res = await pm.sendRequest({\n//   url: 'https://auth.example.com/token',\n//   method: 'POST',\n//   header: { 'Content-Type': 'application/json' },\n//   body: { mode: 'raw', raw: JSON.stringify({ client_id: '{{clientId}}', grant_type: 'client_credentials' }) }\n// });\n// pm.environment.set('token', res.json().access_token);\n\n// Or set variables directly:\n// pm.environment.set('timestamp', String(Date.now()));"}
          />
        </CollapsibleSection>

        <CollapsibleSection className="script-editor" id="post-response-script" title="Post-response script" description="JavaScript that runs after the response, to run tests, assert values, and capture data or chain another request.">

          <p className="field-help">
            Runs after the response. Use <code>pm.response.json()</code>, <code>pm.test(…)</code>, <code>pm.expect(…)</code>,
            or <code>await pm.sendRequest(…)</code> to chain a follow-up call.
          </p>
          <textarea
            className="script-textarea"
            value={request.postResponseScript || ""}
            onChange={event => updateRequest("postResponseScript", event.target.value)}
            spellCheck="false"
            aria-label="Post-response script"
            placeholder={"// Test the response and capture values:\n// pm.test('Status is 200', () => {\n//   pm.expect(pm.response.status).to.equal(200);\n// });\n// const data = pm.response.json();\n// pm.environment.set('token', data.access_token);\n\n// Chain a follow-up request:\n// const detail = await pm.sendRequest('https://api.example.com/users/' + data.id);\n// pm.environment.set('userName', detail.json().name);"}
          />
        </CollapsibleSection>

        <div className="actions">
          {!["GET", "HEAD", "OPTIONS"].includes(request.method) && !["form", "multipart"].includes(request.bodyMode || inferBodyMode(request.contentType)) && (
            <IconButton type="button" icon={<Braces />} onClick={() => formatJsonField(request.body, value => updateRequest("body", value), announce)}>Format JSON</IconButton>
          )}
          <IconButton type="button" icon={<Eraser />} aria-label="Clear current request" disabled={isRequestEmpty} disabledTitle="Nothing to clear" onClick={() => requestConfirm("clear-request", "Clear the current request?", () => setRequest(emptyRequest))}>Clear</IconButton>
          <ConfirmPrompt pending={pendingConfirm} id="clear-request" onResolve={resolveConfirm} />
          <IconButton type="button" icon={<Code2 />} aria-expanded={snippetOpen} aria-controls="snippetPanel" onClick={() => setSnippetOpen(open => !open)}>{snippetOpen ? "Hide snippet" : "Snippet"}</IconButton>
          <label className={`ssl-toggle-label${ignoreSslErrors ? " ssl-toggle-active" : ""}`}>
            <input
              type="checkbox"
              checked={ignoreSslErrors}
              onChange={event => {
                setIgnoreSslErrors(event.target.checked);
                localStorage.setItem("accessible-api-tester-ignore-ssl", String(event.target.checked));
                announce(event.target.checked ? "SSL verification disabled." : "SSL verification enabled.", "ok");
              }}
            />
            Skip SSL
          </label>
          <label className="proxy-url-label">
            <span className="proxy-url-text">Proxy</span>
            <input
              type="url"
              className="proxy-url-input"
              placeholder="http://host:port"
              value={proxyUrl}
              aria-label="Proxy URL"
              onChange={event => {
                setProxyUrl(event.target.value);
                localStorage.setItem("accessible-api-tester-proxy-url", event.target.value);
              }}
            />
          </label>
        </div>

        {snippetOpen && (
          <fieldset id="snippetPanel" className="snippet-panel">
            <legend><h3 className="section-heading">Code Snippet</h3></legend>
            <div className="snippet-toolbar">
              <Field id="snippetLanguage" label="Language">
                <select id="snippetLanguage" value={snippetLanguage} onChange={event => setSnippetLanguage(event.target.value)}>
                  <option value="curl">cURL</option>
                  <option value="javascript">JavaScript (fetch)</option>
                  <option value="python">Python (requests)</option>
                  <option value="csharp">C# (HttpClient)</option>
                </select>
              </Field>
              <IconButton type="button" icon={<Copy />} onClick={copySnippet}>Copy</IconButton>
            </div>
            {snippetData.warning && <p className="snippet-warning" role="alert">{snippetData.warning}</p>}
            <pre className="snippet-output" tabIndex="0" aria-label="Generated code snippet">{snippetData.code}</pre>
          </fieldset>
        )}
      </form>
    </section>

    <section className="panel response-panel" aria-labelledby="responseTitle" tabIndex="-1" ref={responsePanelRef}>
      <h2 id="responseTitle">Response</h2>
      <dl className="summary" aria-label="Response summary">
        <Summary label="Status" value={response ? `${response.status} ${response.statusText}` : "Not sent"} />
        <Summary label="Time" value={response?.durationMs ? `${response.durationMs} ms` : "-"} />
        <Summary label="Size" value={response ? formatBytes(response.body, response.isBase64) : "-"} />
        <Summary label="Assertions" value={assertionSummary.message} />
      </dl>
      {graphqlErrors && (
        <div className="graphql-error-banner" role="alert">
          <p className="graphql-error-title"><AlertTriangle size={16} aria-hidden="true" /> GraphQL returned {graphqlErrors.length} error{graphqlErrors.length === 1 ? "" : "s"}</p>
          <ul className="graphql-error-list">
            {graphqlErrors.map((error, index) => (
              <li key={index}>
                <span className="graphql-error-message">{error.message}</span>
                {error.path && <span className="graphql-error-meta mono"> at {error.path}</span>}
                {error.locations && <span className="graphql-error-meta mono"> ({error.locations})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {response && (
        <dl className="request-meta" aria-label="Request details">
          {effectiveUrl && <div className="request-meta-row"><dt>Request URL</dt><dd className="mono">{effectiveUrl}</dd></div>}
          {authInjected && <div className="request-meta-row"><dt>Auth</dt><dd className="mono">{authInjected.name}: {authInjected.value}</dd></div>}
          {injectedCookies && <div className="request-meta-row"><dt>Cookies sent</dt><dd className="mono">{injectedCookies}</dd></div>}
          {ignoredSsl && <div className="request-meta-row request-meta-warn"><dt>SSL</dt><dd>Certificate validation bypassed</dd></div>}
          {usedProxy && <div className="request-meta-row"><dt>Proxy</dt><dd className="mono">{usedProxy}</dd></div>}
          {timeoutMs && <div className="request-meta-row"><dt>Timeout</dt><dd>{timeoutMs / 1000}s</dd></div>}
        </dl>
      )}
      {captureResults?.length > 0 && (
        <div className="capture-results" aria-label="Captured variables">
          <h3 className="capture-results-title">Captured Variables</h3>
          <dl className="capture-list">
            {captureResults.map((c, i) => (
              <div key={i} className={`capture-row ${c.value !== null ? "capture-ok" : "capture-fail"}`}>
                <dt>{c.name}</dt>
                <dd>{c.value !== null ? c.value : `Error: ${c.error}`}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="response-actions">
        <IconButton type="button" icon={<Download />} disabled={!response} disabledTitle="No response to download" onClick={downloadResponse}>Download response</IconButton>
        {pinnedResponse
          ? <IconButton type="button" icon={<BookmarkX />} onClick={() => { setPinnedResponse(null); announce("Pinned response cleared.", "ok"); }}>Unpin</IconButton>
          : <IconButton type="button" icon={<Bookmark />} disabled={!response} disabledTitle="No response to pin" onClick={() => { setPinnedResponse({ body: responseBody, headers: responseHeaders, raw: rawResponse }); announce("Response pinned for comparison.", "ok"); }}>Pin</IconButton>
        }
        <div className="response-search-wrap">
          <label htmlFor="responseSearch" className="visually-hidden">Search response</label>
          <span className="response-search-icon" aria-hidden="true"><Search size={15} /></span>
          <input
            id="responseSearch"
            type="search"
            className="response-search-input"
            value={responseSearch}
            onChange={event => setResponseSearch(event.target.value)}
            placeholder="Search response…"
            aria-label="Search response body, headers, and raw"
          />
        </div>
      </div>
      <Tabs activeTab={activeResponseTab} setActiveTab={setActiveResponseTab} scriptResult={scriptResult} hasPinned={!!pinnedResponse} hasPreviewableResponse={!!responseMediaCategory} />
      <SearchableTabPanel id="bodyPanel" labelledBy="bodyTab" active={activeResponseTab === "body"} text={`${responseBody}${assertionSummary.failed.length ? `\n\nAssertion failures:\n${assertionSummary.failed.join("\n")}` : ""}`} search={responseSearch} />
      <JsonTreePanel id="treePanel" labelledBy="treeTab" active={activeResponseTab === "tree"} data={response?.isBase64 ? null : response?.body} />
      <SearchableTabPanel id="headersPanel" labelledBy="headersTab" active={activeResponseTab === "headers"} text={responseHeaders} search={responseSearch} />
      <SearchableTabPanel id="rawPanel" labelledBy="rawTab" active={activeResponseTab === "raw"} text={rawResponse} search={responseSearch} />
      <PreviewPanel id="previewPanel" labelledBy="previewTab" active={activeResponseTab === "preview"} response={response} />
      <ScriptPanel id="scriptsPanel" labelledBy="scriptsTab" active={activeResponseTab === "scripts"} scriptResult={scriptResult} />
      <DiffPanel id="diffPanel" labelledBy="diffTab" active={activeResponseTab === "diff"} currentText={response ? responseBody : ""} pinnedText={pinnedResponse?.body || ""} />
    </section>
    </>
  );
}
