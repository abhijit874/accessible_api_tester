import React from "react";
import { Braces, Plus, Save, Trash2 } from "lucide-react";
import { METHODS, emptyMock, mockUrl, formatJsonField } from "../utils.js";
import { Field, IconButton, PanelList, ConfirmPrompt } from "../components.jsx";

export function MocksPanel({ mocks, setMocks, mockDraft, setMockDraft, saveMock, useMockInRequest, clearMockState, pendingConfirm, resolveConfirm, requestConfirm, announce, workspaceStorageKey, workspaceQuery, deleteItem }) {
  const updateMock = (field, value) => setMockDraft(cur => ({ ...cur, [field]: value }));
  return (
    <PanelList title="Mock Server" className="mocks-panel" action={<>
      <IconButton type="button" icon={<Trash2 />} aria-label="Clear all mock routes" disabled={!mocks.length} disabledTitle="Nothing to clear" onClick={() => requestConfirm("clear-mocks", "Clear all mock routes?", () => {
        setMocks([]);
        localStorage.setItem(workspaceStorageKey("mocks"), JSON.stringify([]));
        deleteItem(workspaceQuery("/api/mocks"));
      })}>Clear</IconButton>
      <ConfirmPrompt pending={pendingConfirm} id="clear-mocks" onResolve={resolveConfirm} />
    </>}>
      <form className="mock-form" aria-label="Mock route editor" onSubmit={saveMock}>
        <Field id="mockName" label="Mock name"><input id="mockName" value={mockDraft.name} onChange={e => updateMock("name", e.target.value)} autoComplete="off" placeholder="Example: List users" /></Field>
        <div className="mock-route-line">
          <Field id="mockMethod" label="Method"><select id="mockMethod" value={mockDraft.method} onChange={e => updateMock("method", e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></Field>
          <Field id="mockPath" label="Path under /mock"><input id="mockPath" value={mockDraft.path} onChange={e => updateMock("path", e.target.value)} autoComplete="off" placeholder="/users" /></Field>
          <Field id="mockStatusCode" label="Status"><input id="mockStatusCode" type="number" inputMode="numeric" min="100" max="599" value={mockDraft.statusCode} onChange={e => updateMock("statusCode", e.target.value)} /></Field>
        </div>
        <div className="mock-route-line">
          <Field id="mockContentType" label="Response content type"><input id="mockContentType" value={mockDraft.contentType} onChange={e => updateMock("contentType", e.target.value)} /></Field>
          <Field id="mockDelay" label="Delay (ms)" className="timeout-field">
            <input id="mockDelay" type="number" inputMode="numeric" min="0" max="30000" value={mockDraft.delayMs || ""} onChange={e => updateMock("delayMs", e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field id="mockHeaders" label="Response headers"><textarea id="mockHeaders" value={mockDraft.headers} onChange={e => updateMock("headers", e.target.value)} spellCheck="false" placeholder="Cache-Control: no-store" /></Field>
        {mockDraft.method !== "HEAD" && (
          <Field id="mockBody" label="Response body"><textarea id="mockBody" className="body-editor" value={mockDraft.body} onChange={e => updateMock("body", e.target.value)} spellCheck="false" placeholder={'{\n  "ok": true\n}'} /></Field>
        )}
        <div className="actions">
          <IconButton className="primary" icon={<Save />}>Save mock</IconButton>
          <IconButton type="button" icon={<Plus />} onClick={() => { setMockDraft(emptyMock); announce("New mock ready.", "ok"); }}>New mock</IconButton>
          {mockDraft.method !== "HEAD" && (
            <IconButton type="button" icon={<Braces />} onClick={() => formatJsonField(mockDraft.body, v => updateMock("body", v), announce)}>Format JSON</IconButton>
          )}
        </div>
      </form>
      <p className="field-help">Base URL: {location.origin}/mock</p>
      {mocks.length ? (
        <ol className="history-list">
          {mocks.map(item => (
            <li key={item.id} className="saved-row mock-row">
              <button type="button" onClick={() => setMockDraft({ ...item, statusCode: String(item.statusCode), delayMs: item.delayMs ? String(item.delayMs) : "" })}>{item.name} - {item.method} {mockUrl(item)} - {item.statusCode}{item.delayMs ? ` - ${item.delayMs}ms delay` : ""}</button>
              <button type="button" aria-label={`Use mock route ${item.name}`} onClick={() => useMockInRequest(item)}>Use</button>
              {item.method.toUpperCase() !== "GET" && <><button type="button" aria-label={`Clear state for ${item.name}`} onClick={() => clearMockState(item)}>Clear state</button><ConfirmPrompt pending={pendingConfirm} id={`mock-state-${item.id}`} onResolve={resolveConfirm} /></>}
              <button type="button" className="danger-button" aria-label={`Delete mock route ${item.name}`} onClick={() => requestConfirm(`mock-${item.id}`, `Delete mock "${item.name}"?`, () => {
                const nextMocks = mocks.filter(m => m.id !== item.id);
                setMocks(nextMocks);
                localStorage.setItem(workspaceStorageKey("mocks"), JSON.stringify(nextMocks));
                deleteItem(workspaceQuery(`/api/mocks/${encodeURIComponent(item.id)}`));
              })}>Delete</button>
              <ConfirmPrompt pending={pendingConfirm} id={`mock-${item.id}`} onResolve={resolveConfirm} />
            </li>
          ))}
        </ol>
      ) : <p>No mock routes saved.</p>}
    </PanelList>
  );
}
