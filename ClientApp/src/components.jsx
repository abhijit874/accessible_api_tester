import React, { useState, useMemo, useEffect } from "react";
import { escapeRegex, computeLineDiff, getMediaCategory } from "./utils.js";
import { BUILTIN_CATEGORIES } from "./scriptEngine.js";

// ── Markdown renderer (used by DocsSection) ───────────────────────────────────

function renderMarkdown(text) {
  if (!text) return "";
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = escaped.split("\n");
  const out = [];
  let inCode = false, codeLang = "", codeLines = [], inUl = false, inOl = false;

  const flushList = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const inline = str => str
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inCode && /^```/.test(line)) { flushList(); inCode = true; codeLang = line.slice(3).trim(); codeLines = []; continue; }
    if (inCode) {
      if (/^```/.test(line)) {
        const langAttr = codeLang ? ` class="language-${codeLang}"` : "";
        out.push(`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`);
        inCode = false; codeLang = ""; codeLines = [];
      } else { codeLines.push(line); }
      continue;
    }
    if (/^---+$/.test(line.trim())) { flushList(); out.push("<hr>"); continue; }
    if (/^#{1,6} /.test(line)) { flushList(); const level = line.match(/^(#+)/)[1].length; out.push(`<h${level}>${inline(line.slice(level + 1).trim())}</h${level}>`); continue; }
    if (/^&gt; /.test(line)) { flushList(); out.push(`<blockquote>${inline(line.slice(5))}</blockquote>`); continue; }
    if (/^[-*] /.test(line)) { if (!inUl) { if (inOl) { out.push("</ol>"); inOl = false; } out.push("<ul>"); inUl = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (/^\d+\. /.test(line)) { if (!inOl) { if (inUl) { out.push("</ul>"); inUl = false; } out.push("<ol>"); inOl = true; } out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`); continue; }
    flushList();
    if (line.trim() === "") out.push("<br>"); else out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  flushList();
  return out.join("");
}

// ── DocsSection ───────────────────────────────────────────────────────────────

// Collapsible request section. The title lives in an <h3> (so screen-reader
// heading navigation still jumps to it) wrapped in a disclosure <button> with
// aria-expanded/aria-controls. Collapsed content is removed from the a11y tree
// via the hidden attribute. Advanced/optional sections start collapsed so the
// common path (URL, params, headers, body) stays short.
export function CollapsibleSection({ id, title, className, defaultOpen = false, description, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `${id}-content`;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <fieldset className={className}>
      <legend>
        <h3 className="section-heading">
          <button
            type="button"
            className="section-toggle"
            aria-expanded={open}
            aria-controls={contentId}
            aria-describedby={descriptionId}
            onClick={() => setOpen(value => !value)}
          >
            <span className="section-toggle-icon" aria-hidden="true">{open ? "▾" : "▸"}</span>
            {title}
          </button>
        </h3>
      </legend>
      {description && <span id={descriptionId} className="visually-hidden">{description}</span>}
      <div id={contentId} hidden={!open}>
        {children}
      </div>
    </fieldset>
  );
}

export function DocsSection({ description, onChange }) {
  const [mode, setMode] = useState("edit");
  const rendered = useMemo(() => renderMarkdown(description), [description]);
  return (
    <CollapsibleSection className="docs-editor" id="documentation" title="Documentation" description="Write Markdown notes about this request, with edit and preview modes.">

      <div className="docs-toolbar" role="toolbar" aria-label="Documentation editor controls">
        <button type="button" role="tab" aria-selected={mode === "edit"} className={`docs-tab${mode === "edit" ? " docs-tab-active" : ""}`} onClick={() => setMode("edit")}>Edit</button>
        <button type="button" role="tab" aria-selected={mode === "preview"} className={`docs-tab${mode === "preview" ? " docs-tab-active" : ""}`} onClick={() => setMode("preview")}>Preview</button>
      </div>
      {mode === "edit" ? (
        <textarea
          className="docs-textarea"
          value={description}
          onChange={event => onChange(event.target.value)}
          spellCheck="true"
          aria-label="Request documentation (Markdown)"
          placeholder={"## What this endpoint does\n\nDescribe the purpose, parameters, and expected responses.\n\n### Parameters\n\n- `id` — The resource identifier\n\n### Example response\n\n```json\n{ \"ok\": true }\n```"}
        />
      ) : (
        <div className={`docs-preview${!description.trim() ? " docs-preview-empty" : ""}`} aria-label="Documentation preview">
          {description.trim()
            ? <div className="docs-rendered" dangerouslySetInnerHTML={{ __html: rendered }} />
            : <p>Nothing to preview yet. Switch to Edit and write some documentation.</p>
          }
        </div>
      )}
      <p className="field-help">Supports Markdown: **bold**, *italic*, `code`, headings, lists, links, code blocks.</p>
    </CollapsibleSection>
  );
}

// ── Response tab panels ───────────────────────────────────────────────────────

export function DashboardCard({ section, onOpen }) {
  return (
    <button className="workspace-card" type="button" onClick={onOpen}>
      <span className="workspace-card-icon">{React.cloneElement(section.icon, { "aria-hidden": "true", size: 24 })}</span>
      <span className="workspace-card-body">
        <span className="workspace-card-title">{section.title}</span>
        <span className="workspace-card-meta">{section.meta}</span>
      </span>
      <span className="workspace-card-count">{section.count}</span>
    </button>
  );
}

export function Field({ id, label, helpId, className = "", children }) {
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { "aria-describedby": helpId || children.props["aria-describedby"] })}
    </div>
  );
}

export function IconButton({ icon, children, className = "", disabledTitle, ...props }) {
  const btn = <button className={className} {...props}>{icon && React.cloneElement(icon, { "aria-hidden": "true", size: 18 })}<span>{children}</span></button>;
  if (disabledTitle && props.disabled) return <span title={disabledTitle} className="disabled-btn-wrap">{btn}</span>;
  return btn;
}

export function Pager({ page, onPrevious, onNext }) {
  const start = page.total ? page.skip + 1 : 0;
  const end = Math.min(page.skip + page.items.length, page.total);
  return (
    <div className="pager" aria-label="Pagination">
      <span aria-live="polite" aria-atomic="true">{start}-{end} of {page.total}</span>
      <button type="button" aria-label="Previous page" onClick={onPrevious} disabled={page.skip <= 0}>Previous</button>
      <button type="button" aria-label="Next page" onClick={onNext} disabled={page.skip + page.take >= page.total}>Next</button>
    </div>
  );
}

export function Summary({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

export function Tabs({ activeTab, setActiveTab, scriptResult, hasPinned, hasPreviewableResponse }) {
  const tabs = [
    ["body", "Body"],
    ["tree", "Tree"],
    ["headers", "Headers"],
    ["raw", "Raw"],
    ["preview", hasPreviewableResponse ? <>"Preview" <span aria-hidden="true"> ●</span></> : "Preview", hasPreviewableResponse ? "Preview, response can be rendered" : null],
    ["scripts", "Scripts"],
    ["diff", hasPinned ? <>"Diff" <span aria-hidden="true"> ●</span></> : "Diff", hasPinned ? "Diff, response pinned" : null]
  ];
  function onKeyDown(event, index) {
    if (!["ArrowRight", "ArrowLeft"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + offset + tabs.length) % tabs.length][0];
    setActiveTab(next);
    requestAnimationFrame(() => document.getElementById(`${next}Tab`)?.focus());
  }
  const scriptBadge = scriptResult?.tests.length
    ? (scriptResult.tests.some(t => !t.passed) ? `${scriptResult.tests.filter(t => !t.passed).length} fail` : `${scriptResult.tests.length} pass`)
    : (scriptResult?.preLogs.length || scriptResult?.postLogs.length ? "output" : null);
  const scriptBadgeKind = scriptResult?.tests.some(t => !t.passed) ? "tab-badge-fail" : "tab-badge-pass";
  return (
    <div className="tabs" role="tablist" aria-label="Response views">
      {tabs.map(([id, label, ariaLabel], index) => (
        <button key={id} id={`${id}Tab`} role="tab" aria-selected={activeTab === id} aria-controls={`${id}Panel`} type="button" tabIndex={activeTab === id ? 0 : -1} onClick={() => setActiveTab(id)} onKeyDown={event => onKeyDown(event, index)} {...(ariaLabel ? { "aria-label": ariaLabel } : {})}>
          {label}
          {id === "scripts" && scriptBadge && <span className={`tab-badge ${scriptBadgeKind}`}>{scriptBadge}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, labelledBy, active, text }) {
  return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden={!active}><pre className="output">{text}</pre></div>;
}

export function SearchableTabPanel({ id, labelledBy, active, text, search }) {
  const trimmed = search.trim();
  if (!trimmed) {
    return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden={!active}><pre className="output">{text}</pre></div>;
  }
  let matchCount = 0;
  const regex = new RegExp(escapeRegex(trimmed), "gi");
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<mark key={matchCount} className="search-highlight">{match[0]}</mark>);
    matchCount++;
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden={!active}>
      {trimmed && <p className="search-match-count" aria-live="polite">{matchCount} match{matchCount !== 1 ? "es" : ""} for "{trimmed}"</p>}
      <pre className="output">{parts}</pre>
    </div>
  );
}

// ── JSON tree viewer ──────────────────────────────────────────────────────────

function JsonScalar({ value }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === "boolean") return <span className="json-bool">{String(value)}</span>;
  if (typeof value === "number") return <span className="json-num">{String(value)}</span>;
  return <span className="json-str">"{String(value)}"</span>;
}

function JsonNode({ value, label, depth }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === "object";
  if (!isObj) {
    return (
      <div className="json-row">
        {label != null && <span className="json-key">{label}<span className="json-colon">: </span></span>}
        <JsonScalar value={value} />
      </div>
    );
  }
  const count = isArr ? value.length : Object.keys(value).length;
  const open = isArr ? "[" : "{";
  const close = isArr ? "]" : "}";
  const countLabel = `${count} ${isArr ? "item" : "key"}${count !== 1 ? "s" : ""}`;
  return (
    <div className="json-node">
      <button type="button" className="json-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
        <span className="json-caret" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        {label != null && <span className="json-key">{label}<span className="json-colon">: </span></span>}
        <span className="json-brace">{open}</span>
        {!expanded && <><span className="json-ellipsis">…</span><span className="json-brace">{close}</span></>}
        <span className="json-count">{countLabel}</span>
      </button>
      {expanded && (
        <div className="json-children">
          {isArr
            ? value.map((v, i) => <JsonNode key={i} value={v} label={i} depth={depth + 1} />)
            : Object.entries(value).map(([k, v]) => <JsonNode key={k} value={v} label={k} depth={depth + 1} />)}
        </div>
      )}
      {expanded && <span className="json-brace json-close-brace">{close}</span>}
    </div>
  );
}

function JsonTree({ data }) {
  if (!data) return <p className="json-msg">No response body.</p>;
  let parsed;
  try { parsed = JSON.parse(data); }
  catch { return <p className="json-msg">Response is not valid JSON. Switch to the Body tab to see the raw output.</p>; }
  return <JsonNode value={parsed} label={null} depth={0} />;
}

export function JsonTreePanel({ id, labelledBy, active, data }) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden={!active}>
      <div className="json-tree-panel"><JsonTree data={data} /></div>
    </div>
  );
}

// ── Script panel ──────────────────────────────────────────────────────────────

export function ScriptLogLines({ logs, phase }) {
  if (!logs.length) return null;
  return (
    <div className="script-log-group">
      <p className="script-log-phase">{phase}</p>
      {logs.map((entry, i) => (
        <div key={i} className={`script-log-line script-log-${entry.level}`}>
          <span className="script-log-level" aria-label={entry.level}>{entry.level === "error" ? "✗" : entry.level === "warn" ? "⚠" : "›"}</span>
          <pre className="script-log-text">{entry.text}</pre>
        </div>
      ))}
    </div>
  );
}

export function ScriptVarChanges({ changes, phase }) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return null;
  return (
    <section className="script-var-changes" aria-label={`${phase} variable changes`}>
      <h3>Variable changes — {phase}</h3>
      <dl className="script-var-list">
        {entries.map(([name, value]) => (
          <div key={name} className="script-var-row"><dt>{name}</dt><dd className="mono">{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

export function ScriptPanel({ id, labelledBy, active, scriptResult }) {
  const hasLogs = scriptResult && (scriptResult.preLogs.length || scriptResult.postLogs.length);
  const hasTests = scriptResult?.tests.length > 0;
  const hasVarChanges = Object.keys(scriptResult?.preVarChanges || {}).length > 0 || Object.keys(scriptResult?.postVarChanges || {}).length > 0;
  const passed = scriptResult?.tests.filter(t => t.passed).length ?? 0;
  const total = scriptResult?.tests.length ?? 0;
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden={!active}>
      <div className="script-results">
        {!scriptResult && <p className="script-empty">No scripts ran for the last request. Add a pre-request or post-response script, then send the request.</p>}
        {scriptResult && !hasLogs && !hasTests && !hasVarChanges && <p className="script-empty">Scripts ran but produced no output. Use <code>console.log()</code> or <code>pm.test()</code> to see results here.</p>}
        {hasVarChanges && (<><ScriptVarChanges changes={scriptResult.preVarChanges} phase="Pre-request" /><ScriptVarChanges changes={scriptResult.postVarChanges} phase="Post-response" /></>)}
        {hasLogs && (
          <section className="script-log-section" aria-label="Console output">
            <h3>Console output</h3>
            <ScriptLogLines logs={scriptResult.preLogs} phase="Pre-request" />
            <ScriptLogLines logs={scriptResult.postLogs} phase="Post-response" />
          </section>
        )}
        {hasTests && (
          <section className="script-tests-section" aria-label="Test results">
            <h3>Tests — {passed}/{total} passed</h3>
            <ol className="script-tests">
              {scriptResult.tests.map((test, i) => (
                <li key={i} className={test.passed ? "test-pass" : "test-fail"}>
                  <span className="test-status" aria-hidden="true">{test.passed ? "✓" : "✗"}</span>
                  <span className="test-name">{test.name}</span>
                  {!test.passed && <span className="test-error">{test.error}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Diff panel ────────────────────────────────────────────────────────────────

export function DiffPanel({ id, labelledBy, active, currentText, pinnedText }) {
  const isEmpty = !currentText && !pinnedText;
  const noPinned = !pinnedText;
  const noCurrent = !currentText;
  if (!active) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden />;
  if (isEmpty) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="diff-panel diff-empty"><p>Send a request and pin a response to compare.</p></div>;
  if (noPinned) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="diff-panel diff-empty"><p>Pin the current response first, then send another request to compare.</p></div>;
  const diff = computeLineDiff(pinnedText, currentText || "");
  const added = diff.filter(l => l.type === "added").length;
  const removed = diff.filter(l => l.type === "removed").length;
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="diff-panel">
      <p className="diff-summary" aria-live="polite">
        <span className="diff-added">+{added} added</span>
        <span className="diff-removed">−{removed} removed</span>
        {noCurrent && <span className="diff-note">No current response — showing pinned only.</span>}
      </p>
      <pre className="diff-output" aria-label="Response diff: pinned vs current">
        {diff.map((line, i) => (
          <span key={i} className={`diff-line diff-${line.type}`}>{line.type === "added" ? "+" : line.type === "removed" ? "−" : " "} {line.text}{"\n"}</span>
        ))}
      </pre>
    </div>
  );
}

// ── Preview panel ─────────────────────────────────────────────────────────────

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function PreviewPanel({ id, labelledBy, active, response }) {
  const contentType = response?.headers?.find(h => h.name.toLowerCase() === "content-type")?.value || "";
  const mime = contentType.split(";")[0].trim().toLowerCase();
  const charset = (contentType.match(/charset=([^\s;]+)/i) || [])[1] || "utf-8";
  const body = response?.body || "";
  const isBase64 = response?.isBase64 ?? false;
  const category = getMediaCategory(mime);

  const [objectUrl, setObjectUrl] = useState(null);
  useEffect(() => {
    if (!active || !body || !category) { setObjectUrl(null); return; }
    const blob = isBase64
      ? new Blob([base64ToBytes(body)], { type: mime })
      : new Blob([body], { type: `${mime}; charset=${charset}` });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [active, body, mime, charset, isBase64, category]);

  if (!active) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" hidden />;
  if (!body) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel preview-empty"><p>No response yet. Send a request to see the preview.</p></div>;
  if (!category) return <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel preview-empty"><p>This response type (<code>{mime || "unknown"}</code>) cannot be previewed. Switch to the Body or Raw tab to see the content.</p></div>;

  if (category === "html" || category === "svg") return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel">
      {objectUrl && <iframe key={objectUrl} title="Response preview" src={objectUrl} sandbox="allow-same-origin allow-scripts allow-forms allow-popups" className="preview-iframe" />}
    </div>
  );
  if (category === "image") return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel preview-image-wrap">
      {objectUrl && <img src={objectUrl} alt="Response image" className="preview-image" />}
    </div>
  );
  if (category === "audio") return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel preview-media-wrap">
      {objectUrl && <audio controls src={objectUrl} className="preview-audio" aria-label="Response audio" />}
    </div>
  );
  if (category === "video") return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel preview-media-wrap">
      {objectUrl && <video controls src={objectUrl} className="preview-video" aria-label="Response video" />}
    </div>
  );
  if (category === "pdf") return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} tabIndex="0" className="preview-panel">
      {objectUrl && <iframe key={objectUrl} title="Response PDF preview" src={objectUrl} className="preview-iframe" />}
    </div>
  );
  return null;
}

// ── Built-in variables reference ──────────────────────────────────────────────

export function BuiltinVariablesReference({ announce }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = BUILTIN_CATEGORIES.map(cat => ({
    ...cat,
    items: q ? cat.items.filter(item => item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)) : cat.items
  })).filter(cat => cat.items.length > 0);

  function copy(name) {
    const token = `{{${name}}}`;
    navigator.clipboard?.writeText(token).catch(() => {});
    announce?.(`Copied ${token}`, "ok");
  }

  return (
    <section className="builtin-vars-section" aria-labelledby="builtinVarsTitle">
      <div className="builtin-vars-heading">
        <h3 id="builtinVarsTitle">Built-in Dynamic Variables</h3>
        <button type="button" className="builtin-vars-toggle" aria-expanded={open} aria-controls="builtinVarsBody" onClick={() => setOpen(o => !o)}>{open ? "Hide" : "Show reference"}</button>
      </div>
      <div id="builtinVarsBody" hidden={!open}>
        <p className="field-help">Use <code>{"{{$name}}"}</code> in any URL, header, query param, or body field. A fresh value is generated every time you send the request.</p>
        <div className="builtin-vars-search-wrap">
          <label htmlFor="builtinVarSearch" className="visually-hidden">Search built-in variables</label>
          <input id="builtinVarSearch" type="search" className="builtin-vars-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search variables…" autoComplete="off" />
        </div>
        {filtered.length === 0 && <p className="builtin-vars-empty">No variables match "{search}".</p>}
        {filtered.map(cat => (
          <div key={cat.label} className="builtin-vars-category">
            <h4 className="builtin-vars-cat-label">{cat.label}</h4>
            <ul className="builtin-vars-list">
              {cat.items.map(item => (
                <li key={item.name} className="builtin-vars-row">
                  <button type="button" className="builtin-var-token-btn" aria-label={`Copy ${item.name} — ${item.desc}`} title="Click to copy" onClick={() => copy(item.name)}><code>{`{{${item.name}}}`}</code></button>
                  <span className="builtin-var-desc">{item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Layout components ─────────────────────────────────────────────────────────

export function PanelList({ title, action, className = "", children }) {
  const id = `${title.replace(/\s+/g, "").toLowerCase()}Title`;
  return (
    <aside className={`panel ${className || `${id.replace("Title", "")}-panel`}`} aria-labelledby={id}>
      <div className="history-heading"><h2 id={id}>{title}</h2>{action}</div>
      <div className="history-list">{children}</div>
    </aside>
  );
}

export function ConfirmPrompt({ pending, id, onResolve }) {
  if (!pending || pending.id !== id) return null;
  return (
    <div className="confirm-prompt" role="alert">
      <span className="confirm-message">{pending.message}</span>
      <button type="button" className="danger-button" onClick={() => onResolve(true)}>Confirm</button>
      <button type="button" onClick={() => onResolve(false)}>Cancel</button>
    </div>
  );
}
