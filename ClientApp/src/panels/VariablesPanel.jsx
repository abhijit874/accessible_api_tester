import React from "react";
import {
  Cookie,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Save,
  Trash2
} from "lucide-react";
import {
  Field, IconButton,
  BuiltinVariablesReference,
  ConfirmPrompt, PanelList,
} from "../components.jsx";

export function VariablesPanel({
  // variables
  variables,
  setVariables,
  variableDraft,
  setVariableDraft,
  variableDraftSecret,
  setVariableDraftSecret,
  saveVariable,
  revealedSecrets,
  setRevealedSecrets,
  exportVariables,
  importVariablesFile,
  variablesFileRef,
  // collection variables
  collectionVariables,
  setCollectionVariables,
  colVarDraft,
  setColVarDraft,
  colVarDraftSecret,
  setColVarDraftSecret,
  saveCollectionVariable,
  // cookie jar
  cookieJar,
  setCookieJar,
  cookieJarEnabled,
  setCookieJarEnabled,
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
    <PanelList title="Variables" className="environments-panel" action={<div className="toolbar-actions"><IconButton type="button" icon={<Download />} disabled={!variables.length} onClick={exportVariables}>Export</IconButton><label className="file-button" htmlFor="importVariables"><FileUp aria-hidden="true" size="18" /> Import</label><input id="importVariables" ref={variablesFileRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importVariablesFile} /><><IconButton type="button" icon={<Trash2 />} aria-label="Clear all variables" disabled={!variables.length} disabledTitle="Nothing to clear" onClick={() => requestConfirm("clear-variables", "Clear all variables?", () => {
        setVariables([]);
        localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify([]));
        deleteItem(workspaceQuery("/api/environments"));
      })}>Clear</IconButton><ConfirmPrompt pending={pendingConfirm} id="clear-variables" onResolve={resolveConfirm} /></></div>}>
      <form className="environment-form" aria-label="Add or edit variable" onSubmit={saveVariable}>
        <Field id="environmentName" label="Variable name"><input id="environmentName" value={variableDraft.name} onChange={event => setVariableDraft(current => ({ ...current, name: event.target.value }))} autoComplete="off" placeholder="baseUrl" /></Field>
        <Field id="environmentValue" label="Variable value">
          <input id="environmentValue" value={variableDraft.value} onChange={event => setVariableDraft(current => ({ ...current, value: event.target.value }))} type={variableDraftSecret ? "password" : "text"} autoComplete="off" placeholder="https://api.example.com" />
        </Field>
        <label className="secret-toggle-label">
          <input type="checkbox" checked={variableDraftSecret} onChange={event => setVariableDraftSecret(event.target.checked)} />
          Secret (masked)
        </label>
        <IconButton icon={<Save />}>Save variable</IconButton>
      </form>
      {variables.length ? (
        <ol className="history-list">
          {variables.map(item => (
            <li key={item.id} className="saved-row">
              <button type="button" onClick={() => { setVariableDraft({ name: item.name, value: item.value }); setVariableDraftSecret(!!item.secret); }}>
                <span>{item.name}</span>
                <span className="variable-token">{`{{${item.name}}}`}</span>
                {item.secret && <span className="secret-badge">secret</span>}
                <span className="variable-value-preview">{item.secret && !revealedSecrets.has(item.id) ? "••••••••" : item.value}</span>
              </button>
              {item.secret && (
                <button type="button" aria-label={revealedSecrets.has(item.id) ? `Hide value of ${item.name}` : `Reveal value of ${item.name}`} onClick={() => setRevealedSecrets(current => { const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}>
                  {revealedSecrets.has(item.id) ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  <span className="visually-hidden">{revealedSecrets.has(item.id) ? "Hide" : "Reveal"}</span>
                </button>
              )}
              <button type="button" className="danger-button" aria-label={`Delete variable ${item.name}`} onClick={() => requestConfirm(`variable-${item.id}`, `Delete variable "${item.name}"?`, () => {
                  const nextVariables = variables.filter(variable => variable.id !== item.id);
                  setVariables(nextVariables);
                  localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(nextVariables));
                  deleteItem(workspaceQuery(`/api/environments/${encodeURIComponent(item.id)}`));
                })}>Delete</button>
              <ConfirmPrompt pending={pendingConfirm} id={`variable-${item.id}`} onResolve={resolveConfirm} />
            </li>
          ))}
        </ol>
      ) : <p>No variables saved.</p>}

      <section className="collection-vars-section" aria-labelledby="collectionVarsTitle">
        <div className="collection-vars-heading">
          <h3 id="collectionVarsTitle">Collection Variables</h3>
        </div>
        <p className="field-help">
          Available in all requests as a fallback when no environment variable with the same name exists.
          Override them per-environment by setting the same name in the Variables list above.
          Access in scripts with <code>pm.collectionVariables.get()</code> and <code>pm.collectionVariables.set()</code>.
        </p>
        <form className="environment-form" aria-label="Add or edit collection variable" onSubmit={saveCollectionVariable}>
          <Field id="colVarName" label="Variable name"><input id="colVarName" value={colVarDraft.name} onChange={event => setColVarDraft(current => ({ ...current, name: event.target.value }))} autoComplete="off" placeholder="apiVersion" /></Field>
          <Field id="colVarValue" label="Variable value">
            <input id="colVarValue" value={colVarDraft.value} onChange={event => setColVarDraft(current => ({ ...current, value: event.target.value }))} type={colVarDraftSecret ? "password" : "text"} autoComplete="off" placeholder="v2" />
          </Field>
          <label className="secret-toggle-label">
            <input type="checkbox" checked={colVarDraftSecret} onChange={event => setColVarDraftSecret(event.target.checked)} />
            Secret (masked)
          </label>
          <IconButton icon={<Save />}>Save</IconButton>
        </form>
        {collectionVariables.length ? (
          <ol className="history-list">
            {collectionVariables.map(item => (
              <li key={item.id} className="saved-row">
                <button type="button" onClick={() => { setColVarDraft({ name: item.name, value: item.value }); setColVarDraftSecret(!!item.secret); }}>
                  <span>{item.name}</span>
                  <span className="variable-token">{`{{${item.name}}}`}</span>
                  {item.secret && <span className="secret-badge">secret</span>}
                  <span className="variable-value-preview">{item.secret ? "••••••••" : item.value}</span>
                </button>
                <button type="button" className="danger-button" aria-label={`Delete collection variable ${item.name}`} onClick={() => requestConfirm(`colvar-${item.id}`, `Delete collection variable "${item.name}"?`, () => {
                    const next = collectionVariables.filter(v => v.id !== item.id);
                    setCollectionVariables(next);
                    localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify(next));
                    deleteItem(workspaceQuery(`/api/collection-variables/${encodeURIComponent(item.id)}`));
                  })}>Delete</button>
                <ConfirmPrompt pending={pendingConfirm} id={`colvar-${item.id}`} onResolve={resolveConfirm} />
              </li>
            ))}
          </ol>
        ) : <p className="collection-vars-empty">No collection variables saved.</p>}
        {!!collectionVariables.length && (
          <><IconButton type="button" icon={<Trash2 />} aria-label="Clear all collection variables" onClick={() => requestConfirm("clear-col-vars", "Clear all collection variables?", () => {
              setCollectionVariables([]);
              localStorage.setItem(workspaceStorageKey("collection-variables"), JSON.stringify([]));
              deleteItem(workspaceQuery("/api/collection-variables"));
            })}>Clear all</IconButton><ConfirmPrompt pending={pendingConfirm} id="clear-col-vars" onResolve={resolveConfirm} /></>
        )}
      </section>

      <BuiltinVariablesReference announce={announce} />

      <section className="cookie-jar-section" aria-labelledby="cookieJarTitle">
        <div className="cookie-jar-heading">
          <h3 id="cookieJarTitle"><Cookie size={15} aria-hidden="true" /> Cookie Jar</h3>
          <label className="secret-toggle-label">
            <input type="checkbox" checked={cookieJarEnabled} onChange={event => { setCookieJarEnabled(event.target.checked); localStorage.setItem("accessible-api-tester-cookies-enabled", String(event.target.checked)); announce(event.target.checked ? "Cookie jar enabled." : "Cookie jar disabled.", "ok"); }} />
            Enabled
          </label>
          {Object.keys(cookieJar).length > 0 && (
            <><IconButton type="button" icon={<Trash2 />} onClick={() => requestConfirm("clear-cookies", "Clear all stored cookies?", () => { setCookieJar({}); localStorage.removeItem("accessible-api-tester-cookies"); announce("All cookies cleared.", "ok"); })}>Clear all</IconButton>
            <ConfirmPrompt pending={pendingConfirm} id="clear-cookies" onResolve={resolveConfirm} /></>
          )}
        </div>
        {Object.keys(cookieJar).length === 0
          ? <p className="cookie-jar-empty">No cookies stored. Cookies set by API responses will appear here when the jar is enabled.</p>
          : (
            <ol className="history-list cookie-list">
              {Object.entries(cookieJar).map(([hostname, cookies]) => (
                <li key={hostname} className="cookie-host-group">
                  <div className="cookie-host-label">
                    <h4 className="cookie-hostname">{hostname}</h4>
                    <IconButton type="button" icon={<Trash2 />} aria-label={`Clear cookies for ${hostname}`} onClick={() => { setCookieJar(cur => { const n = {...cur}; delete n[hostname]; localStorage.setItem("accessible-api-tester-cookies", JSON.stringify(n)); return n; }); announce(`Cookies for ${hostname} cleared.`, "ok"); }}>Clear</IconButton>
                  </div>
                  <ol className="cookie-items">
                    {Object.values(cookies).map(cookie => (
                      <li key={cookie.name} className="cookie-item">
                        <span className="cookie-name"><span className="visually-hidden">Name: </span>{cookie.name}</span>
                        <span className="cookie-value"><span className="visually-hidden">Value: </span>{cookie.value}</span>
                        {cookie.expires && <span className="cookie-meta"><span className="visually-hidden">Expires: </span>{new Date(cookie.expires).toLocaleString()}</span>}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )
        }
      </section>
    </PanelList>
  );
}
