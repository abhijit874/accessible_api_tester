import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bookmark,
  BookmarkX,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Cookie,
  Copy,
  Database,
  Diff,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileUp,
  FolderOpen,
  History,
  Home,
  KeyRound,
  Layers,
  Moon,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  Trash2
} from "lucide-react";
import * as jsyaml from "js-yaml";
import "./styles/index.css";

import {
  METHODS, PAGE_SIZE, SECTION_TITLES,
  emptyAssertions, defaultAssertionSummary, emptyRequest, emptyMock,
  storageJson, createId, cloneRequestDraft, createRequestTab,
  requestTabTitle, requestTabCloseLabel, requestTabAriaLabel,
  normalizeAuthType, parseHeaders, parseHeaderRows, serializeHeaderRows,
  parseParamRows, serializeParamRows, emptyKeyValueRows,
  parseUrlQueryRaw, buildBarQuery, stripUrlQuery,
  parseFormRows, serializeKeyValueRows,
  inferBodyMode, bodyContentTypeForMode, parseGraphqlBody,
  GRAPHQL_INTROSPECTION_QUERY, parseIntrospectionSchema,
  fileToBase64,
  resolveVariables, applyAuthorization, appendQueryParams,
  normalizeAssertions, buildAssertions, hasAssertions,
  buildRequest,
  normalizeFolder, parseCurlCommand,
  formatBytes, extForMime, prettyBody, getMediaCategory,
  evaluateAssertions, runCaptures,
  applyVarChangesToList,
  normalizeMockPath, mockUrl, generateSnippet, isStateChangingLocalMockRequest,
  getCookiesForUrl, updateCookieJar,
  buildCollectionTree,
  randomBase64Url, createCodeChallenge,
  formatJsonField,
  applyFolderInheritance,
} from "./utils.js";
import {
  runPreRequestScript,
  runPostResponseScript,
  buildScriptSendResponse,
} from "./scriptEngine.js";
import { useSendRequest } from "./hooks/useSendRequest.js";
import { useCollectionRunner } from "./hooks/useCollectionRunner.js";
import { useCollectionActions } from "./hooks/useCollectionActions.js";
import { useWorkspaceActions } from "./hooks/useWorkspaceActions.js";
import {
  importOpenApi,
  importPostmanCollection,
  exportPostmanCollection,
  importInsomniaCollection,
  importRequestsFromJson,
} from "./importExport.js";
import {
  DocsSection, DashboardCard,
  Field, IconButton, Pager, Summary,
  Tabs, TabPanel, SearchableTabPanel,
  JsonTreePanel,
  ScriptLogLines, ScriptVarChanges, ScriptPanel,
  DiffPanel, PreviewPanel,
  BuiltinVariablesReference, PanelList, ConfirmPrompt,
} from "./components.jsx";
import { RequestPanel } from "./panels/RequestPanel.jsx";
import { CollectionsPanel } from "./panels/CollectionsPanel.jsx";
import { VariablesPanel } from "./panels/VariablesPanel.jsx";
import { WorkspacePanel } from "./panels/WorkspacePanel.jsx";
import { EnvironmentsPanel } from "./panels/EnvironmentsPanel.jsx";
import { SettingsPanel } from "./panels/SettingsPanel.jsx";
import { MocksPanel } from "./panels/MocksPanel.jsx";

function App() {
  const [requestWorkspace, setRequestWorkspace] = useState(() => {
    const initialTab = createRequestTab();
    return { tabs: [initialTab], activeId: initialTab.id };
  });
  const [activeResponseTab, setActiveResponseTab] = useState("body");
  const [status, setStatus] = useState({ message: "Ready.", kind: "" });
  const [spoken, setSpoken] = useState({ polite: "", assertive: "" });
  const [history, setHistory] = useState([]);
  const [collections, setCollections] = useState([]);
  const [historyPage, setHistoryPage] = useState({ items: [], total: 0, skip: 0, take: PAGE_SIZE });
  const [collectionPage, setCollectionPage] = useState({ items: [], total: 0, skip: 0, take: PAGE_SIZE });
  const [historyQuery, setHistoryQuery] = useState("");
  const [collectionQuery, setCollectionQuery] = useState("");
  const [curlImportText, setCurlImportText] = useState("");
  const [variables, setVariables] = useState([]);
  const [collectionVariables, setCollectionVariables] = useState([]);
  const [mocks, setMocks] = useState([]);
  const [collectionResults, setCollectionResults] = useState([]);
  const [folderSettings, setFolderSettings] = useState({});
  const [editingFolderPath, setEditingFolderPath] = useState(null);
  const [folderSettingsDraft, setFolderSettingsDraft] = useState({});
  const [activeSection, setActiveSection] = useState("home");
  const [workspaces, setWorkspaces] = useState([{ id: "default", name: "Default", updatedAt: "" }]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("default");
  const [workspaceDraft, setWorkspaceDraft] = useState("");
  const [variableDraft, setVariableDraft] = useState({ name: "", value: "" });
  const [colVarDraft, setColVarDraft] = useState({ name: "", value: "" });
  const [colVarDraftSecret, setColVarDraftSecret] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [mockDraft, setMockDraft] = useState(emptyMock);
  const [folderMode, setFolderMode] = useState("none");
  const [oauth, setOauth] = useState({ clientId: "", clientSecret: "", scopes: "openid email profile", redirectUri: "" });
  const [isSending, setIsSending] = useState(false);
  const [isRunningCollection, setIsRunningCollection] = useState(false);
  const [includedInRun, setIncludedInRun] = useState(new Set());
  const [snippetLanguage, setSnippetLanguage] = useState("curl");
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [graphqlSchema, setGraphqlSchema] = useState(null);
  const [graphqlSchemaError, setGraphqlSchemaError] = useState("");
  const [graphqlSchemaLoading, setGraphqlSchemaLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(null);
  const [ignoreSslErrors, setIgnoreSslErrors] = useState(() => localStorage.getItem("accessible-api-tester-ignore-ssl") === "true");
  const [proxyUrl, setProxyUrl] = useState(() => localStorage.getItem("accessible-api-tester-proxy-url") || "");
  const [defaultTimeout, setDefaultTimeout] = useState(() => localStorage.getItem("accessible-api-tester-default-timeout") || "");
  const [theme, setTheme] = useState(() => localStorage.getItem("accessible-api-tester-theme") || "light");
  const [responseSearch, setResponseSearch] = useState("");
  const [variableDraftSecret, setVariableDraftSecret] = useState(false);
  const [revealedSecrets, setRevealedSecrets] = useState(new Set());
  const [cookieJar, setCookieJar] = useState(() => storageJson("accessible-api-tester-cookies", {}));
  const [cookieJarEnabled, setCookieJarEnabled] = useState(() => localStorage.getItem("accessible-api-tester-cookies-enabled") !== "false");
  const [pinnedResponse, setPinnedResponse] = useState(null);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const skipLinkRef = useRef(null);
  const fileRef = useRef(null);
  const openApiFileRef = useRef(null);
  const variablesFileRef = useRef(null);
  const responsePanelRef = useRef(null);
  const collectionResultsRef = useRef(null);
  const workspaceHydratedRef = useRef(false);
  const statusTimeoutRef = useRef(null);
  const spokenTimeoutRef = useRef(null);

  useEffect(() => { skipLinkRef.current?.focus(); }, []);
  const requestTabs = requestWorkspace.tabs;
  const activeRequestTab = requestTabs.find(tab => tab.id === requestWorkspace.activeId) || requestTabs[0];
  const request = activeRequestTab?.request || emptyRequest;
  const response = activeRequestTab?.response || null;
  const effectiveUrl = activeRequestTab?.effectiveUrl || null;
  const authInjected = activeRequestTab?.authInjected || null;
  const injectedCookies = activeRequestTab?.injectedCookies || null;
  const ignoredSsl = activeRequestTab?.ignoredSsl || false;
  const usedProxy = activeRequestTab?.usedProxy || null;
  const timeoutMs = activeRequestTab?.timeoutMs || null;
  const captureResults = activeRequestTab?.captureResults || null;
  const assertionSummary = activeRequestTab?.assertionSummary || defaultAssertionSummary;
  const scriptResult = activeRequestTab?.scriptResult || null;
  const isRequestEmpty = !request.url && !request.name && !request.body && !request.authToken && request.method === "GET" && !request.preRequestScript && !request.postResponseScript && !(request.paramRows?.some(r => r.name || r.value)) && !(request.headerRows?.some(r => r.name || r.value)) && !hasAssertions(request.assertions) && !request.captures?.length;

  const updateRequestTabById = useCallback((tabId, update) => {
    setRequestWorkspace(current => ({
      ...current,
      tabs: current.tabs.map(tab => tab.id === tabId ? update(tab) : tab)
    }));
  }, []);

  const updateActiveRequestTab = useCallback((update) => {
    setRequestWorkspace(current => ({
      ...current,
      tabs: current.tabs.map(tab => tab.id === current.activeId ? update(tab) : tab)
    }));
  }, []);

  const setRequest = useCallback((value) => {
    updateActiveRequestTab(tab => ({
      ...tab,
      request: cloneRequestDraft(typeof value === "function" ? value(tab.request) : value)
    }));
  }, [updateActiveRequestTab]);

  const setResponse = useCallback((value) => {
    updateActiveRequestTab(tab => ({ ...tab, response: typeof value === "function" ? value(tab.response) : value }));
  }, [updateActiveRequestTab]);

  const setAssertionSummary = useCallback((value) => {
    updateActiveRequestTab(tab => ({
      ...tab,
      assertionSummary: typeof value === "function" ? value(tab.assertionSummary) : value
    }));
  }, [updateActiveRequestTab]);

  const announce = useCallback((message, kind = "", options = {}) => {
    setStatus({ message, kind });
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    if (kind === "ok") {
      statusTimeoutRef.current = setTimeout(() => setStatus({ message: "", kind: "" }), 5000);
    }
    if (options.speak === false) return;
    const spokenMessage = kind === "error" ? `Error: ${message}` : message;
    const useAssertive = kind === "error" || kind === "assertive";
    setSpoken(useAssertive ? { polite: "", assertive: spokenMessage } : { polite: spokenMessage, assertive: "" });
    if (spokenTimeoutRef.current) clearTimeout(spokenTimeoutRef.current);
    spokenTimeoutRef.current = setTimeout(() => setSpoken({ polite: "", assertive: "" }), 1000);
  }, []);

  const openRequestTab = useCallback((draft = emptyRequest, options = {}) => {
    const tab = createRequestTab(draft);
    setRequestWorkspace(current => ({ tabs: [...current.tabs, tab], activeId: tab.id }));
    if (options.activateRequests !== false) {
      setActiveSection("requests");
    }
    return tab.id;
  }, []);

  const closeRequestTab = useCallback((tabId) => {
    setRequestWorkspace(current => {
      if (current.tabs.length === 1) {
        const replacement = createRequestTab();
        return { tabs: [replacement], activeId: replacement.id };
      }
      const tabIndex = current.tabs.findIndex(tab => tab.id === tabId);
      const nextTabs = current.tabs.filter(tab => tab.id !== tabId);
      const nextActiveId = current.activeId === tabId
        ? nextTabs[Math.max(0, tabIndex - 1)]?.id || nextTabs[0].id
        : current.activeId;
      return { tabs: nextTabs, activeId: nextActiveId };
    });
  }, []);

  const newRequestTab = useCallback(() => {
    openRequestTab();
    announce("New request tab ready.", "ok");
  }, [announce, openRequestTab]);

  const workspaceStorageKey = useCallback((suffix, workspaceId = activeWorkspaceId) => {
    const normalizedWorkspaceId = workspaceId === "default" ? "default" : encodeURIComponent(workspaceId);
    return workspaceId === "default"
      ? `accessible-api-tester-${suffix}`
      : `accessible-api-tester-${suffix}-${normalizedWorkspaceId}`;
  }, [activeWorkspaceId]);

  const workspaceQuery = useCallback((path, workspaceId = activeWorkspaceId) => {
    const parameters = new URLSearchParams({ workspaceId });
    return `${path}?${parameters}`;
  }, [activeWorkspaceId]);

  const readBrowserWorkspaceState = useCallback((workspaceId) => ({
    history: storageJson(workspaceStorageKey("history", workspaceId), workspaceId === "default" ? storageJson("accessible-api-tester-history", []) : []),
    collections: storageJson(workspaceStorageKey("collections", workspaceId), workspaceId === "default" ? storageJson("accessible-api-tester-collections", []) : []),
    environments: storageJson(workspaceStorageKey("environments", workspaceId), workspaceId === "default" ? storageJson("accessible-api-tester-environments", []) : []),
    mocks: storageJson(workspaceStorageKey("mocks", workspaceId), workspaceId === "default" ? storageJson("accessible-api-tester-mocks", []) : []),
    collectionVariables: storageJson(workspaceStorageKey("collection-variables", workspaceId), []),
    folderSettings: storageJson(workspaceStorageKey("folder-settings", workspaceId), {})
  }), [workspaceStorageKey]);

  const saveState = useCallback(async (workspaceId, next) => {
    localStorage.setItem(workspaceStorageKey("history", workspaceId), JSON.stringify(next.history));
    localStorage.setItem(workspaceStorageKey("collections", workspaceId), JSON.stringify(next.collections));
    localStorage.setItem(workspaceStorageKey("environments", workspaceId), JSON.stringify(next.environments));
    localStorage.setItem(workspaceStorageKey("mocks", workspaceId), JSON.stringify(next.mocks));
    localStorage.setItem(workspaceStorageKey("collection-variables", workspaceId), JSON.stringify(next.collectionVariables ?? []));
    localStorage.setItem(workspaceStorageKey("folder-settings", workspaceId), JSON.stringify(next.folderSettings ?? {}));
    try {
      const response = await fetch(workspaceQuery("/api/store", workspaceId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });
      if (!response.ok) throw new Error("Saved request storage could not be updated.");
    } catch (error) {
      announce(`${error.message} Browser backup was updated.`, "error", { speak: false });
    }
  }, [announce, workspaceQuery, workspaceStorageKey]);

  const syncStorage = useCallback(async (path, options, fallbackMessage = "Browser backup was updated.") => {
    try {
      const response = await fetch(path, options);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Saved request storage could not be updated.");
      }
    } catch (error) {
      announce(`${error.message} ${fallbackMessage}`, "error", { speak: false });
    }
  }, [announce]);

  const putItem = useCallback((path, item) => syncStorage(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item)
  }), [syncStorage]);

  const deleteItem = useCallback((path) => syncStorage(path, { method: "DELETE" }), [syncStorage]);

  const refreshMocksFromStore = useCallback(async () => {
    try {
      const response = await fetch(workspaceQuery("/api/store"));
      if (!response.ok) throw new Error("Mock state could not be refreshed.");
      const state = await response.json();
      const nextMocks = Array.isArray(state.mocks) ? state.mocks : mocks;
      setMocks(nextMocks);
      localStorage.setItem(workspaceStorageKey("mocks"), JSON.stringify(nextMocks));
    } catch (error) {
      announce(`${error.message} Showing browser backup.`, "error", { speak: false });
    }
  }, [announce, mocks, workspaceQuery, workspaceStorageKey]);

  const fetchPaged = useCallback(async (path, query, skip, fallbackItems, setPage, workspaceId = activeWorkspaceId) => {
    try {
      const parameters = new URLSearchParams({
        workspaceId,
        skip: String(skip),
        take: String(PAGE_SIZE)
      });
      if (query.trim()) {
        parameters.set("query", query.trim());
      }

      const response = await fetch(`${path}?${parameters}`);
      if (!response.ok) throw new Error("Paged data could not be loaded.");
      const page = await response.json();
      setPage({
        items: Array.isArray(page.items) ? page.items : [],
        total: Number(page.total) || 0,
        skip: Number(page.skip) || 0,
        take: Number(page.take) || PAGE_SIZE
      });
    } catch (error) {
      const normalizedQuery = query.trim().toLowerCase();
      const filtered = normalizedQuery
        ? fallbackItems.filter(item => [item.folder, item.name, item.method, item.url, item.status].some(value => String(value ?? "").toLowerCase().includes(normalizedQuery)))
        : fallbackItems;
      setPage({ items: filtered.slice(skip, skip + PAGE_SIZE), total: filtered.length, skip, take: PAGE_SIZE });
      announce(`${error.message} Showing browser backup.`, "error", { speak: false });
    }
  }, [activeWorkspaceId, announce]);

  const persist = useCallback((updates, workspaceId = activeWorkspaceId) => {
    const next = {
      history,
      collections,
      environments: variables,
      mocks,
      collectionVariables,
      ...updates
    };
    if (updates.history) setHistory(updates.history);
    if (updates.collections) setCollections(updates.collections);
    if (updates.environments) setVariables(updates.environments);
    if (updates.mocks) setMocks(updates.mocks);
    if (updates.collectionVariables) setCollectionVariables(updates.collectionVariables);
    saveState(workspaceId, next);
  }, [activeWorkspaceId, collections, collectionVariables, history, mocks, saveState, variables]);

  useEffect(() => {
    async function load() {
      const storedWorkspaces = storageJson("accessible-api-tester-workspaces", []);
      const storedActiveWorkspace = String(localStorage.getItem("accessible-api-tester-active-workspace") || "default");
      let workspaceCatalog = Array.isArray(storedWorkspaces) && storedWorkspaces.length ? storedWorkspaces : [{ id: "default", name: "Default", updatedAt: new Date().toISOString() }];
      let workspaceId = storedActiveWorkspace || "default";
      if (!workspaceCatalog.some(item => item.id === workspaceId)) {
        workspaceId = workspaceCatalog[0]?.id || "default";
      }

      try {
        const workspacesResponse = await fetch("/api/workspaces");
        if (workspacesResponse.ok) {
          const loadedWorkspaces = await workspacesResponse.json();
          if (Array.isArray(loadedWorkspaces) && loadedWorkspaces.length) {
            workspaceCatalog = loadedWorkspaces;
            if (!workspaceCatalog.some(item => item.id === workspaceId)) {
              workspaceId = workspaceCatalog[0].id;
            }
          }
        }

        localStorage.setItem("accessible-api-tester-workspaces", JSON.stringify(workspaceCatalog));
        localStorage.setItem("accessible-api-tester-active-workspace", workspaceId);
        setWorkspaces(workspaceCatalog);
        setActiveWorkspaceId(workspaceId);

        await fetch(workspaceQuery("/api/workspaces/active", workspaceId), { method: "PUT" });

        const response = await fetch(workspaceQuery("/api/store", workspaceId));
        if (!response.ok) throw new Error("Saved request storage could not be loaded.");
        const state = await response.json();
        const fallback = readBrowserWorkspaceState(workspaceId);
        setHistory(Array.isArray(state.history) ? state.history : fallback.history);
        setCollections(Array.isArray(state.collections) ? state.collections : fallback.collections);
        setVariables(Array.isArray(state.environments) ? state.environments : fallback.environments);
        setMocks(Array.isArray(state.mocks) ? state.mocks : fallback.mocks);
        setCollectionVariables(Array.isArray(state.collectionVariables) ? state.collectionVariables : fallback.collectionVariables);
        setFolderSettings(state.folderSettings && typeof state.folderSettings === "object" && !Array.isArray(state.folderSettings) ? state.folderSettings : (fallback.folderSettings ?? {}));
      } catch (error) {
        const fallback = readBrowserWorkspaceState(workspaceId);
        setHistory(fallback.history);
        setCollections(fallback.collections);
        setVariables(fallback.environments);
        setMocks(fallback.mocks);
        setCollectionVariables(fallback.collectionVariables);
        setFolderSettings(fallback.folderSettings ?? {});
        announce(`${error.message} Using browser backup for this session.`, "error", { speak: false });
      }

      setProfiles(storageJson(workspaceStorageKey("profiles", workspaceId), []));
      setActiveProfileId(localStorage.getItem(workspaceStorageKey("activeProfile", workspaceId)) || null);

      const settings = storageJson("accessible-api-tester-google-oauth-settings", {});
      setOauth({
        clientId: settings.clientId || "",
        clientSecret: "",
        scopes: settings.scopes || "openid email profile",
        redirectUri: `${location.origin}/oauth/google/callback`
      });
      workspaceHydratedRef.current = true;
    }
    load();
  }, [announce, readBrowserWorkspaceState, workspaceQuery]);

  useEffect(() => {
    if (!workspaceHydratedRef.current) return;
    if (!workspaces.length) return;

    async function loadWorkspace() {
      localStorage.setItem("accessible-api-tester-active-workspace", activeWorkspaceId);
      await fetch(workspaceQuery("/api/workspaces/active", activeWorkspaceId), { method: "PUT" });
      const fallback = readBrowserWorkspaceState(activeWorkspaceId);
      try {
        const response = await fetch(workspaceQuery("/api/store", activeWorkspaceId));
        if (!response.ok) throw new Error("Saved request storage could not be loaded.");
        const state = await response.json();
        setHistory(Array.isArray(state.history) ? state.history : fallback.history);
        setCollections(Array.isArray(state.collections) ? state.collections : fallback.collections);
        setVariables(Array.isArray(state.environments) ? state.environments : fallback.environments);
        setMocks(Array.isArray(state.mocks) ? state.mocks : fallback.mocks);
        setCollectionVariables(Array.isArray(state.collectionVariables) ? state.collectionVariables : fallback.collectionVariables);
        setFolderSettings(state.folderSettings && typeof state.folderSettings === "object" && !Array.isArray(state.folderSettings) ? state.folderSettings : (fallback.folderSettings ?? {}));
      } catch (error) {
        setHistory(fallback.history);
        setCollections(fallback.collections);
        setVariables(fallback.environments);
        setMocks(fallback.mocks);
        setCollectionVariables(fallback.collectionVariables);
        setFolderSettings(fallback.folderSettings ?? {});
        announce(`${error.message} Using browser backup for this workspace.`, "error", { speak: false });
      }
      setProfiles(storageJson(workspaceStorageKey("profiles"), []));
      setActiveProfileId(localStorage.getItem(workspaceStorageKey("activeProfile")) || null);
    }

    loadWorkspace();
  }, [activeWorkspaceId, announce, readBrowserWorkspaceState, workspaces.length, workspaceQuery]);

  useEffect(() => {
    async function handleCallback() {
      const callbackText = sessionStorage.getItem("accessible-api-tester-google-oauth-callback");
      if (!callbackText) return;
      sessionStorage.removeItem("accessible-api-tester-google-oauth-callback");
      try {
        const callbackData = JSON.parse(callbackText);
        const pending = JSON.parse(sessionStorage.getItem("accessible-api-tester-google-oauth-pending") || "{}");
        if (callbackData.error) throw new Error(callbackData.errorDescription || callbackData.error);
        if (!callbackData.code) throw new Error("Google did not return an authorization code.");
        if (!pending.state || callbackData.state !== pending.state) throw new Error("Google sign-in state did not match. Start sign-in again.");
        announce("Exchanging Google authorization code.");
        const tokenResponse = await fetch("/api/oauth/google/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: callbackData.code,
            clientId: pending.clientId,
            clientSecret: pending.clientSecret,
            redirectUri: pending.redirectUri,
            codeVerifier: pending.codeVerifier
          })
        });
        const token = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(token.error_description || token.message || token.error || "Google token exchange failed.");
        const nextVariables = [...variables];
        for (const [name, value] of [["google_access_token", token.access_token], ["google_id_token", token.id_token], ["google_refresh_token", token.refresh_token]]) {
          if (!value) continue;
          const existing = nextVariables.find(item => item.name.toLowerCase() === name);
          const saved = { id: existing?.id || createId(), name, value, updatedAt: new Date().toISOString() };
          const index = nextVariables.findIndex(item => item.id === saved.id);
          if (index >= 0) nextVariables[index] = saved;
          else nextVariables.unshift(saved);
        }
        setVariables(nextVariables);
        localStorage.setItem(workspaceStorageKey("environments"), JSON.stringify(nextVariables));
        nextVariables.forEach(item => putItem(workspaceQuery(`/api/environments/${encodeURIComponent(item.id)}`), item));
        sessionStorage.removeItem("accessible-api-tester-google-oauth-pending");
        setRequest(current => ({ ...current, authType: "bearer", authToken: "{{google_access_token}}" }));
        announce("Google token saved to variables.", "ok");
      } catch (error) {
        announce(error.message, "error");
      }
    }
    handleCallback();
  }, [announce, putItem, variables]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const sectionInitialRef = useRef(true);
  useEffect(() => {
    const sectionTitle = SECTION_TITLES[activeSection] || "Accessible API Tester";
    document.title = `${sectionTitle} - Accessible API Tester`;
    if (sectionInitialRef.current) { sectionInitialRef.current = false; return; }
    announce(`${sectionTitle}.`);
  }, [activeSection, announce]);

  useEffect(() => {
    if (activeSection !== "history") return;
    fetchPaged("/api/history", historyQuery, historyPage.skip, history, setHistoryPage, activeWorkspaceId);
  }, [activeSection, activeWorkspaceId, fetchPaged, history, historyPage.skip, historyQuery]);

  useEffect(() => {
    if (activeSection !== "collections") return;
    fetchPaged("/api/collections", collectionQuery, collectionPage.skip, collections, setCollectionPage, activeWorkspaceId);
  }, [activeSection, activeWorkspaceId, collectionPage.skip, collectionQuery, collections, fetchPaged]);

  // Rebuilds the URL bar text from the base (path) plus the enabled param rows,
  // keeping the URL bar and Query params table in sync (Postman/Insomnia style).
  const recomputeUrlFromRows = (url, rows) => stripUrlQuery(String(url || "")) + buildBarQuery(rows);
  // Typing in the URL bar parses its query string back into the param rows.
  // Disabled rows (not represented in the URL) are preserved.
  const updateUrlField = (value) => {
    const isGraphqlUrl = /\/graphql\b/i.test(value);
    const currentBodyMode = request.bodyMode || inferBodyMode(request.contentType);
    if (isGraphqlUrl && (request.method !== "POST" || currentBodyMode !== "graphql")) {
      announce("GraphQL URL detected. Switched to POST and GraphQL body mode.", "assertive");
    }
    setRequest(current => {
      const { rows } = parseUrlQueryRaw(value);
      const disabledRows = (Array.isArray(current.paramRows) ? current.paramRows : [])
        .filter(row => row && row.enabled === false && (String(row.name || "").length || String(row.value || "").length));
      const merged = [...rows, ...disabledRows];
      const hasBlank = merged.some(row => !String(row.name || "").trim() && !String(row.value || "").trim());
      const paramRows = hasBlank ? merged : [...merged, { enabled: true, name: "", value: "" }];
      const currentBodyModeInner = current.bodyMode || inferBodyMode(current.contentType);
      const graphqlOverrides = isGraphqlUrl && current.method !== "POST" ? { method: "POST" } : {};
      const graphqlBodyOverrides = isGraphqlUrl && currentBodyModeInner !== "graphql" ? { bodyMode: "graphql", contentType: "application/json" } : {};
      return { ...current, url: value, paramRows: paramRows.length ? paramRows : [{ enabled: true, name: "", value: "" }], ...graphqlOverrides, ...graphqlBodyOverrides };
    });
  };
  const updateRequest = (field, value) => {
    if (field === "url") return updateUrlField(value);
    setRequest(current => ({ ...current, [field]: value }));
  };
  const updateAssertion = (field, value) => setRequest(current => ({ ...current, assertions: { ...normalizeAssertions(current.assertions), [field]: value } }));
  const addJsonpathAssertion = () => setRequest(current => {
    const assertions = normalizeAssertions(current.assertions);
    return { ...current, assertions: { ...assertions, jsonpathAssertions: [...assertions.jsonpathAssertions, { id: createId(), path: "", operator: "equals", expected: "" }] } };
  });
  const updateJsonpathAssertion = (index, field, value) => setRequest(current => {
    const assertions = normalizeAssertions(current.assertions);
    return { ...current, assertions: { ...assertions, jsonpathAssertions: assertions.jsonpathAssertions.map((a, i) => i === index ? { ...a, [field]: value } : a) } };
  });
  const removeJsonpathAssertion = (index) => setRequest(current => {
    const assertions = normalizeAssertions(current.assertions);
    return { ...current, assertions: { ...assertions, jsonpathAssertions: assertions.jsonpathAssertions.filter((_, i) => i !== index) } };
  });
  const updateMock = (field, value) => setMockDraft(current => ({ ...current, [field]: value }));
  const updateHeaderRow = (index, field, value) => setRequest(current => {
    const rows = Array.isArray(current.headerRows) && current.headerRows.length ? current.headerRows : parseHeaderRows(current.headers);
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    const hasBlank = nextRows.some(row => !String(row.name || "").trim() && !String(row.value || "").trim());
    return { ...current, headerRows: hasBlank ? nextRows : [...nextRows, { enabled: true, name: "", value: "" }] };
  });
  const removeHeaderRow = (index) => setRequest(current => {
    const rows = Array.isArray(current.headerRows) && current.headerRows.length ? current.headerRows : parseHeaderRows(current.headers);
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    return { ...current, headerRows: nextRows.length ? nextRows : [{ enabled: true, name: "", value: "" }] };
  });
  const updateFormRow = (index, field, value) => setRequest(current => {
    const rows = Array.isArray(current.formRows) && current.formRows.length ? current.formRows : parseFormRows(current.body);
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    const hasBlank = nextRows.some(row => !String(row.name || "").trim() && !String(row.value || "").trim());
    return { ...current, formRows: hasBlank ? nextRows : [...nextRows, ...emptyKeyValueRows()] };
  });
  const removeFormRow = (index) => setRequest(current => {
    const rows = Array.isArray(current.formRows) && current.formRows.length ? current.formRows : parseFormRows(current.body);
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    return { ...current, formRows: nextRows.length ? nextRows : emptyKeyValueRows() };
  });
  const updateParamRow = (index, field, value) => setRequest(current => {
    const rows = Array.isArray(current.paramRows) && current.paramRows.length ? current.paramRows : parseParamRows(current.params);
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    const hasBlank = nextRows.some(row => !String(row.name || "").trim() && !String(row.value || "").trim());
    const paramRows = hasBlank ? nextRows : [...nextRows, { enabled: true, name: "", value: "" }];
    return { ...current, paramRows, url: recomputeUrlFromRows(current.url, paramRows) };
  });
  const removeParamRow = (index) => setRequest(current => {
    const rows = Array.isArray(current.paramRows) && current.paramRows.length ? current.paramRows : parseParamRows(current.params);
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    const paramRows = nextRows.length ? nextRows : [{ enabled: true, name: "", value: "" }];
    return { ...current, paramRows, url: recomputeUrlFromRows(current.url, paramRows) };
  });

  const addMultipartFileRow = () => setRequest(current => ({
    ...current,
    multipartFileRows: [...(current.multipartFileRows || []), { id: createId(), enabled: true, fieldName: "", file: null }]
  }));
  const updateMultipartFileRow = (index, field, value) => setRequest(current => {
    const rows = Array.isArray(current.multipartFileRows) ? current.multipartFileRows : [];
    return { ...current, multipartFileRows: rows.map((row, i) => i === index ? { ...row, [field]: value } : row) };
  });
  const removeMultipartFileRow = (index) => setRequest(current => {
    const rows = Array.isArray(current.multipartFileRows) ? current.multipartFileRows : [];
    return { ...current, multipartFileRows: rows.filter((_, i) => i !== index) };
  });

  const addCapture = () => setRequest(current => ({
    ...current,
    captures: [...(Array.isArray(current.captures) ? current.captures : []), { id: createId(), variableName: "", source: "body", path: "" }]
  }));
  const updateCapture = (index, field, value) => setRequest(current => {
    const captures = Array.isArray(current.captures) ? current.captures : [];
    return { ...current, captures: captures.map((c, i) => i === index ? { ...c, [field]: value } : c) };
  });
  const removeCapture = (index) => setRequest(current => {
    const captures = Array.isArray(current.captures) ? current.captures : [];
    return { ...current, captures: captures.filter((_, i) => i !== index) };
  });

  const { sendApiRequest, sendFromScript, sendCurrentRequest, downloadResponse } = useSendRequest({
    request, variables, collectionVariables, folderSettings, cookieJar, cookieJarEnabled,
    ignoreSslErrors, proxyUrl, defaultTimeout, history, activeRequestTab,
    setVariables, setCollectionVariables, setCookieJar, setIsSending, setHistory, setActiveResponseTab,
    updateRequestTabById, refreshMocksFromStore, putItem, workspaceQuery, workspaceStorageKey,
    announce, responsePanelRef,
  });

  async function fetchGraphqlSchema() {
    setGraphqlSchemaLoading(true);
    setGraphqlSchemaError("");
    try {
      const inherited = applyFolderInheritance(request, folderSettings);
      // Force a plain JSON body so buildRequest skips GraphQL-variable parsing;
      // we only want the resolved URL, headers, auth, and timeout from it.
      const base = buildRequest({ ...inherited, bodyMode: "json", body: "" }, variables, true, defaultTimeout, collectionVariables);
      const result = await sendApiRequest({
        method: "POST",
        url: base.url,
        headers: base.headers.filter(header => header.name.toLowerCase() !== "content-type"),
        contentType: "application/json",
        body: JSON.stringify({ query: GRAPHQL_INTROSPECTION_QUERY }),
        timeoutMs: base.timeoutMs,
        authType: base.authType,
        authToken: base.authToken,
      });
      let json;
      try { json = JSON.parse(result.body); } catch { throw new Error("Endpoint did not return JSON."); }
      if (Array.isArray(json.errors) && json.errors.length) throw new Error(json.errors.map(e => e.message).join("; "));
      const schema = parseIntrospectionSchema(json);
      if (!schema) throw new Error("No __schema in response — is this a GraphQL endpoint?");
      setGraphqlSchema({ url: base.url, ...schema });
      announce(`Loaded GraphQL schema: ${schema.types.length} types.`, "ok");
    } catch (error) {
      setGraphqlSchema(null);
      setGraphqlSchemaError(error.message);
      announce(`Schema introspection failed: ${error.message}`, "error");
    } finally {
      setGraphqlSchemaLoading(false);
    }
  }

  function requestConfirm(id, message, onConfirm) {
    setPendingConfirm({ id, message, onConfirm });
  }
  function resolveConfirm(confirmed) {
    setPendingConfirm(current => {
      if (confirmed && current) current.onConfirm();
      return null;
    });
  }

  const folderSuggestions = useMemo(() => Array.from(new Set(collections.map(item => normalizeFolder(item.folder)).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [collections]);
  const collectionActions = useCollectionActions({
    request, variables, collectionVariables, collections, collectionResults,
    mocks, curlImportText, setCurlImportText,
    bulkSelected, setBulkSelected, setBulkMoveTarget,
    profiles, activeProfileId, setActiveProfileId, setProfiles, profileNameDraft, setProfileNameDraft,
    variableDraft, setVariableDraft, variableDraftSecret, setVariableDraftSecret,
    colVarDraft, setColVarDraft, colVarDraftSecret, setColVarDraftSecret,
    mockDraft, folderSuggestions, setFolderMode,
    setCollections, setCollectionResults, setMocks, setVariables, setCollectionVariables,
    includedInRun, setIncludedInRun,
    openRequestTab, requestConfirm, announce,
    putItem, deleteItem, workspaceQuery, workspaceStorageKey, persist,
  });
  const {
    saveCurrentRequest, restoreSavedRequest, duplicateCollectionItem,
    mergeImportedCollections, importCollections, importOpenApiFile, importCurl,
    exportCollections, exportPostmanCollections, exportRunResults, exportVariables,
    importVariablesFile,
    toggleRunInclusion, toggleFolderInclusion, deleteSelectedCollections, moveSelectedToFolder,
    applyProfile, saveProfile, deleteProfile,
    saveVariable, saveCollectionVariable, saveMock,
  } = collectionActions;

  const { runCollection, summarizeCollection, saveFolderSettings } = useCollectionRunner({
    collections, variables, collectionVariables, cookieJar, cookieJarEnabled,
    folderSettings, defaultTimeout, history, mocks,
    setVariables, setCollectionVariables, setCookieJar,
    setIsRunningCollection, setCollectionResults, collectionResults,
    sendApiRequest, sendFromScript,
    putItem, workspaceQuery, workspaceStorageKey,
    announce, collectionResultsRef,
    includedInRun,
    syncStorage,
  });

  const { switchWorkspace, createWorkspace, deleteWorkspace } = useWorkspaceActions({
    workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId,
    workspaceDraft, setWorkspaceDraft,
    setHistoryPage, setCollectionPage, setCollectionResults, setRequestWorkspace,
    workspaceQuery, workspaceStorageKey, requestConfirm, announce,
  });

  function useMockInRequest(item) {
    setRequest({
      ...emptyRequest,
      name: item.name,
      method: item.method,
      url: mockUrl(item),
      contentType: item.contentType || "application/json",
      assertions: { ...emptyAssertions, statusCode: item.statusCode }
    });
    setActiveSection("requests");
    announce(`Loaded mock URL for ${item.name}.`, "ok");
  }

  function clearMockState(item) {
    const path = normalizeMockPath(item.path);
    requestConfirm(`mock-state-${item.id}`, `Clear stored GET state for ${path}?`, async () => {
      const nextMocks = mocks.filter(mock => !(mock.method.toUpperCase() === "GET" && normalizeMockPath(mock.path).toLowerCase() === path.toLowerCase()));
      setMocks(nextMocks);
      localStorage.setItem(workspaceStorageKey("mocks"), JSON.stringify(nextMocks));
      await deleteItem(workspaceQuery(`/api/mock-state?path=${encodeURIComponent(path)}`));
      announce(`Cleared mock state for ${path}.`, "ok");
    });
  }

  async function startGoogleOAuth(event) {
    event.preventDefault();
    if (!oauth.clientId.trim()) {
      announce("Enter a Google OAuth client ID.", "error");
      return;
    }
    if (!oauth.scopes.trim()) {
      announce("Enter at least one Google OAuth scope.", "error");
      return;
    }
    const state = randomBase64Url();
    const nonce = randomBase64Url();
    const codeVerifier = randomBase64Url(64);
    const codeChallenge = await createCodeChallenge(codeVerifier);
    sessionStorage.setItem("accessible-api-tester-google-oauth-pending", JSON.stringify({
      clientId: oauth.clientId.trim(),
      clientSecret: oauth.clientSecret.trim(),
      redirectUri: oauth.redirectUri,
      scopes: oauth.scopes.trim(),
      state,
      nonce,
      codeVerifier
    }));
    localStorage.setItem("accessible-api-tester-google-oauth-settings", JSON.stringify({ clientId: oauth.clientId.trim(), scopes: oauth.scopes.trim() }));
    const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizeUrl.searchParams.set("client_id", oauth.clientId.trim());
    authorizeUrl.searchParams.set("redirect_uri", oauth.redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", oauth.scopes.trim());
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("nonce", nonce);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");
    authorizeUrl.searchParams.set("access_type", "offline");
    authorizeUrl.searchParams.set("prompt", "consent");
    announce("Opening Google sign-in.");
    location.assign(authorizeUrl.toString());
  }

  const snippetData = useMemo(() => {
    if (!snippetOpen) return { code: "", warning: null };
    try {
      let built;
      let warning = null;
      try {
        built = buildRequest(request, variables, true);
      } catch {
        built = buildRequest(request, variables, false);
        warning = "Some variables could not be resolved — snippet may contain unresolved {{placeholders}}.";
      }
      return { code: generateSnippet(built.method, built.url, built.headers, built.body, snippetLanguage, built.contentType), warning };
    } catch {
      return { code: "// Could not generate snippet. Check the request fields.", warning: null };
    }
  }, [snippetOpen, request, variables, snippetLanguage]);

  function copySnippet() {
    navigator.clipboard.writeText(snippetData.code).then(
      () => announce("Snippet copied to clipboard.", "ok"),
      () => announce("Could not copy to clipboard.", "error")
    );
  }

  const responseContentType = response?.headers?.find(h => h.name.toLowerCase() === "content-type")?.value || "";
  const responseMime = responseContentType.split(";")[0].trim().toLowerCase();
  const responseMediaCategory = getMediaCategory(responseMime);
  const responseBody = response
    ? (response.isBase64
        ? `[Binary response (${responseMime || "unknown type"}) — ${formatBytes(response.body, true)} — open the Preview tab to view]`
        : prettyBody(response.body))
    : "No response body.";
  const responseHeaders = response?.headers?.length ? response.headers.map(header => `${header.name}: ${header.value}`).join("\n") : "No response headers.";
  const rawResponse = response
    ? `HTTP ${response.status} ${response.statusText}\n${(response.headers || []).map(h => `${h.name}: ${h.value}`).join("\n")}\n\n${response.isBase64 ? `[Binary body — ${formatBytes(response.body, true)} — open the Preview tab to view]` : (response.body || "")}`
    : "No raw response.";
  const collectionSummary = summarizeCollection();
  const collectionTree = useMemo(() => buildCollectionTree(collectionPage.items), [collectionPage.items]);
  const activeWorkspace = workspaces.find(item => item.id === activeWorkspaceId) || { id: activeWorkspaceId, name: activeWorkspaceId === "default" ? "Default" : activeWorkspaceId };
  const workspaceSections = [
    { id: "requests", title: "Requests", icon: <Send />, meta: response ? `Last response: ${response.status}` : "Build and send API requests", count: request.url ? "Draft ready" : "New draft" },
    { id: "collections", title: "Collections", icon: <FolderOpen />, meta: "Saved requests and collection runs", count: `${collections.length} saved` },
    { id: "history", title: "History", icon: <History />, meta: "Recent request activity", count: `${history.length} item${history.length === 1 ? "" : "s"}` },
    { id: "variables", title: "Variables", icon: <Database />, meta: "Reusable values such as base URLs and tokens", count: `${variables.length} saved` },
    { id: "environments", title: "Environments", icon: <Layers />, meta: "Named variable sets for dev, staging, and prod", count: `${profiles.length} profile${profiles.length === 1 ? "" : "s"}` },
    { id: "mocks", title: "Mock Server", icon: <Server />, meta: "Local mock endpoints for testing", count: `${mocks.length} route${mocks.length === 1 ? "" : "s"}` },
    { id: "oauth", title: "Google OAuth", icon: <ShieldCheck />, meta: "Create token variables with OAuth PKCE", count: oauth.clientId ? "Configured" : "Not configured" },
    { id: "settings", title: "Settings", icon: <Settings />, meta: "Global defaults for SSL, proxy, and timeout", count: ignoreSslErrors ? "SSL off" : proxyUrl ? "Proxy set" : defaultTimeout ? `Timeout: ${defaultTimeout}s` : "" }
  ];

  return (
    <>
      <a ref={skipLinkRef} href="#main-content" className="skip-link">Skip to main content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <div>
          <h1>Accessible API Tester</h1>
          <p className={`status ${status.kind}`.trim()}>{status.message}</p>
          <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{spoken.polite}</p>
          <p className="visually-hidden" role="alert" aria-atomic="true">{spoken.assertive}</p>
          </div>
          <nav className="workspace-nav" aria-label="Workspace navigation">
            <ul className="nav-list">
              <li>
                <a
                  href="#main-content"
                  className={`nav-link${activeSection === "home" ? " nav-active" : ""}`}
                  aria-current={activeSection === "home" ? "page" : undefined}
                  onClick={e => { e.preventDefault(); setActiveSection("home"); }}
                >
                  <Home aria-hidden="true" size={18} />
                  <span>Home</span>
                </a>
              </li>
              <li>
                <a
                  href="#main-content"
                  className={`nav-link${activeSection === "workspace" ? " nav-active" : ""}`}
                  aria-current={activeSection === "workspace" ? "page" : undefined}
                  onClick={e => { e.preventDefault(); setActiveSection("workspace"); }}
                >
                  <Database aria-hidden="true" size={18} />
                  <span>Workspace</span>
                </a>
              </li>
              {workspaceSections.map(section => (
                <li key={section.id}>
                  <a
                    href="#main-content"
                    className={`nav-link${activeSection === section.id ? " nav-active" : ""}`}
                    aria-current={activeSection === section.id ? "page" : undefined}
                    onClick={e => { e.preventDefault(); setActiveSection(section.id); }}
                  >
                    {React.cloneElement(section.icon, { "aria-hidden": "true", size: 18 })}
                    <span>{section.title}</span>
                  </a>
                </li>
              ))}
            </ul>
            <IconButton
              type="button"
              icon={theme === "dark" ? <Sun /> : <Moon />}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                localStorage.setItem("accessible-api-tester-theme", next);
                announce(`${next === "dark" ? "Dark" : "Light"} mode enabled.`, "ok");
              }}
            >{theme === "dark" ? "Light" : "Dark"}</IconButton>
          </nav>
        </div>
      </header>

      <main id="main-content" className={activeSection === "home" ? "landing" : "layout"}>
        {activeSection === "home" && (
          <section className="landing-panel" aria-labelledby="landingTitle">
            <div className="landing-heading">
              <p className="eyebrow">Workspace</p>
              <h2 id="landingTitle">Choose what you want to work on</h2>
            </div>
            <div className="workspace-grid">
              {workspaceSections.map(section => (
                <DashboardCard key={section.id} section={section} onOpen={() => setActiveSection(section.id)} />
              ))}
            </div>
          </section>
        )}

        {activeSection === "workspace" && (
          <WorkspacePanel workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} activeWorkspace={activeWorkspace} workspaceDraft={workspaceDraft} setWorkspaceDraft={setWorkspaceDraft} pendingConfirm={pendingConfirm} resolveConfirm={resolveConfirm} switchWorkspace={switchWorkspace} createWorkspace={createWorkspace} deleteWorkspace={deleteWorkspace} />
        )}

        {activeSection === "requests" && (
        <RequestPanel
          requestTabs={requestTabs}
          activeRequestTab={activeRequestTab}
          request={request}
          setRequest={setRequest}
          setRequestWorkspace={setRequestWorkspace}
          closeRequestTab={closeRequestTab}
          newRequestTab={newRequestTab}
          updateRequest={updateRequest}
          updateAssertion={updateAssertion}
          addJsonpathAssertion={addJsonpathAssertion}
          updateJsonpathAssertion={updateJsonpathAssertion}
          removeJsonpathAssertion={removeJsonpathAssertion}
          updateHeaderRow={updateHeaderRow}
          removeHeaderRow={removeHeaderRow}
          updateParamRow={updateParamRow}
          removeParamRow={removeParamRow}
          updateFormRow={updateFormRow}
          removeFormRow={removeFormRow}
          updateMultipartFileRow={updateMultipartFileRow}
          removeMultipartFileRow={removeMultipartFileRow}
          addMultipartFileRow={addMultipartFileRow}
          addCapture={addCapture}
          updateCapture={updateCapture}
          removeCapture={removeCapture}
          sendCurrentRequest={sendCurrentRequest}
          isSending={isSending}
          response={response}
          effectiveUrl={effectiveUrl}
          authInjected={authInjected}
          injectedCookies={injectedCookies}
          ignoredSsl={ignoredSsl}
          usedProxy={usedProxy}
          timeoutMs={timeoutMs}
          captureResults={captureResults}
          assertionSummary={assertionSummary}
          scriptResult={scriptResult}
          responseBody={responseBody}
          responseHeaders={responseHeaders}
          rawResponse={rawResponse}
          activeResponseTab={activeResponseTab}
          setActiveResponseTab={setActiveResponseTab}
          responseSearch={responseSearch}
          setResponseSearch={setResponseSearch}
          responseMediaCategory={responseMediaCategory}
          downloadResponse={downloadResponse}
          pinnedResponse={pinnedResponse}
          setPinnedResponse={setPinnedResponse}
          announce={announce}
          responsePanelRef={responsePanelRef}
          pendingConfirm={pendingConfirm}
          requestConfirm={requestConfirm}
          resolveConfirm={resolveConfirm}
          folderMode={folderMode}
          setFolderMode={setFolderMode}
          folderSuggestions={folderSuggestions}
          folderSettings={folderSettings}
          snippetOpen={snippetOpen}
          setSnippetOpen={setSnippetOpen}
          snippetLanguage={snippetLanguage}
          setSnippetLanguage={setSnippetLanguage}
          snippetData={snippetData}
          copySnippet={copySnippet}
          graphqlSchema={graphqlSchema}
          graphqlSchemaError={graphqlSchemaError}
          graphqlSchemaLoading={graphqlSchemaLoading}
          fetchGraphqlSchema={fetchGraphqlSchema}
          clearGraphqlSchema={() => { setGraphqlSchema(null); setGraphqlSchemaError(""); }}
          ignoreSslErrors={ignoreSslErrors}
          setIgnoreSslErrors={setIgnoreSslErrors}
          proxyUrl={proxyUrl}
          setProxyUrl={setProxyUrl}
          requestTabTitle={requestTabTitle}
          requestTabCloseLabel={requestTabCloseLabel}
          requestTabAriaLabel={requestTabAriaLabel}
          isRequestEmpty={isRequestEmpty}
          saveCurrentRequest={saveCurrentRequest}
        />
        )}

        {activeSection === "history" && (
        <PanelList title="History" action={<><IconButton type="button" icon={<Trash2 />} aria-label="Clear all history" disabled={!history.length} disabledTitle="Nothing to clear" onClick={() => requestConfirm("clear-history", "Clear all request history?", () => {
            setHistory([]);
            localStorage.setItem(workspaceStorageKey("history"), JSON.stringify([]));
            deleteItem(workspaceQuery("/api/history"));
          })}>Clear all</IconButton><ConfirmPrompt pending={pendingConfirm} id="clear-history" onResolve={resolveConfirm} /></>}>
          <div className="search-row">
            <Field id="historySearch" label="Search history"><input id="historySearch" value={historyQuery} onChange={event => { setHistoryQuery(event.target.value); setHistoryPage(current => ({ ...current, skip: 0 })); }} autoComplete="off" placeholder="Search method, URL, or status" /></Field>
          </div>
          {historyPage.items.length ? (
            <ol className="history-list">
              {historyPage.items.map(item => (
                <li key={item.id} className="saved-row">
                  <button type="button" onClick={() => restoreSavedRequest({ ...item, name: `${item.method} ${item.url}`, assertions: emptyAssertions })}>{item.method} {item.url} {item.status}</button>
                  <button type="button" className="danger-button" aria-label={`Clear ${item.method} ${item.url} from history`} onClick={() => requestConfirm(`history-${item.id}`, `Clear ${item.method} ${item.url} from history?`, () => {
                      const nextHistory = history.filter(historyItem => historyItem.id !== item.id);
                      setHistory(nextHistory);
                      localStorage.setItem(workspaceStorageKey("history"), JSON.stringify(nextHistory));
                      deleteItem(workspaceQuery(`/api/history/${encodeURIComponent(item.id)}`));
                    })}>Clear</button>
                  <ConfirmPrompt pending={pendingConfirm} id={`history-${item.id}`} onResolve={resolveConfirm} />
                </li>
              ))}
            </ol>
          ) : <p>No requests found.</p>}
          <Pager page={historyPage} onPrevious={() => setHistoryPage(current => ({ ...current, skip: Math.max(0, current.skip - current.take) }))} onNext={() => setHistoryPage(current => ({ ...current, skip: current.skip + current.take }))} />
        </PanelList>
        )}

        {activeSection === "collections" && (
        <CollectionsPanel
          collections={collections}
          setCollections={setCollections}
          collectionPage={collectionPage}
          setCollectionPage={setCollectionPage}
          collectionQuery={collectionQuery}
          setCollectionQuery={setCollectionQuery}
          collectionTree={collectionTree}
          collectionResults={collectionResults}
          collectionSummary={collectionSummary}
          collapsedFolders={collapsedFolders}
          setCollapsedFolders={setCollapsedFolders}
          folderSettings={folderSettings}
          editingFolderPath={editingFolderPath}
          setEditingFolderPath={setEditingFolderPath}
          folderSettingsDraft={folderSettingsDraft}
          setFolderSettingsDraft={setFolderSettingsDraft}
          saveFolderSettings={saveFolderSettings}
          isRunningCollection={isRunningCollection}
          runCollection={runCollection}
          includedInRun={includedInRun}
          toggleRunInclusion={toggleRunInclusion}
          toggleFolderInclusion={toggleFolderInclusion}
          bulkMode={bulkMode}
          setBulkMode={setBulkMode}
          bulkSelected={bulkSelected}
          setBulkSelected={setBulkSelected}
          bulkMoveTarget={bulkMoveTarget}
          setBulkMoveTarget={setBulkMoveTarget}
          folderSuggestions={folderSuggestions}
          moveSelectedToFolder={moveSelectedToFolder}
          deleteSelectedCollections={deleteSelectedCollections}
          exportCollections={exportCollections}
          exportPostmanCollections={exportPostmanCollections}
          exportRunResults={exportRunResults}
          importCollections={importCollections}
          importOpenApiFile={importOpenApiFile}
          importCurl={importCurl}
          restoreSavedRequest={restoreSavedRequest}
          duplicateCollectionItem={duplicateCollectionItem}
          curlImportText={curlImportText}
          setCurlImportText={setCurlImportText}
          fileRef={fileRef}
          openApiFileRef={openApiFileRef}
          collectionResultsRef={collectionResultsRef}
          pendingConfirm={pendingConfirm}
          requestConfirm={requestConfirm}
          resolveConfirm={resolveConfirm}
          announce={announce}
          workspaceStorageKey={workspaceStorageKey}
          workspaceQuery={workspaceQuery}
          deleteItem={deleteItem}
        />
        )}

        {activeSection === "variables" && (
        <VariablesPanel
          variables={variables}
          setVariables={setVariables}
          variableDraft={variableDraft}
          setVariableDraft={setVariableDraft}
          variableDraftSecret={variableDraftSecret}
          setVariableDraftSecret={setVariableDraftSecret}
          saveVariable={saveVariable}
          revealedSecrets={revealedSecrets}
          setRevealedSecrets={setRevealedSecrets}
          exportVariables={exportVariables}
          importVariablesFile={importVariablesFile}
          variablesFileRef={variablesFileRef}
          collectionVariables={collectionVariables}
          setCollectionVariables={setCollectionVariables}
          colVarDraft={colVarDraft}
          setColVarDraft={setColVarDraft}
          colVarDraftSecret={colVarDraftSecret}
          setColVarDraftSecret={setColVarDraftSecret}
          saveCollectionVariable={saveCollectionVariable}
          cookieJar={cookieJar}
          setCookieJar={setCookieJar}
          cookieJarEnabled={cookieJarEnabled}
          setCookieJarEnabled={setCookieJarEnabled}
          pendingConfirm={pendingConfirm}
          requestConfirm={requestConfirm}
          resolveConfirm={resolveConfirm}
          announce={announce}
          workspaceStorageKey={workspaceStorageKey}
          workspaceQuery={workspaceQuery}
          deleteItem={deleteItem}
        />
        )}


        {activeSection === "environments" && (
          <EnvironmentsPanel profiles={profiles} activeProfileId={activeProfileId} profileNameDraft={profileNameDraft} setProfileNameDraft={setProfileNameDraft} applyProfile={applyProfile} saveProfile={saveProfile} deleteProfile={deleteProfile} />
        )}

        {activeSection === "settings" && (
          <SettingsPanel ignoreSslErrors={ignoreSslErrors} setIgnoreSslErrors={setIgnoreSslErrors} proxyUrl={proxyUrl} setProxyUrl={setProxyUrl} defaultTimeout={defaultTimeout} setDefaultTimeout={setDefaultTimeout} announce={announce} />
        )}

        {activeSection === "mocks" && (
          <MocksPanel mocks={mocks} setMocks={setMocks} mockDraft={mockDraft} setMockDraft={setMockDraft} saveMock={saveMock} useMockInRequest={useMockInRequest} clearMockState={clearMockState} pendingConfirm={pendingConfirm} resolveConfirm={resolveConfirm} requestConfirm={requestConfirm} announce={announce} workspaceStorageKey={workspaceStorageKey} workspaceQuery={workspaceQuery} deleteItem={deleteItem} />
        )}

        {activeSection === "oauth" && (
        <section className="panel google-oauth-panel" aria-labelledby="googleOAuthTitle">
          <h2 id="googleOAuthTitle">Google OAuth</h2>
          <form className="google-oauth-form" aria-labelledby="googleOAuthTitle" onSubmit={startGoogleOAuth}>
            <Field id="googleClientId" label="Client ID"><input id="googleClientId" value={oauth.clientId} onChange={event => setOauth(current => ({ ...current, clientId: event.target.value }))} autoComplete="off" placeholder="Google OAuth client ID" /></Field>
            <Field id="googleClientSecret" label="Client secret"><input id="googleClientSecret" value={oauth.clientSecret} onChange={event => setOauth(current => ({ ...current, clientSecret: event.target.value }))} type="password" autoComplete="off" placeholder="Optional for PKCE clients" /></Field>
            <Field id="googleScopes" label="Scopes"><input id="googleScopes" value={oauth.scopes} onChange={event => setOauth(current => ({ ...current, scopes: event.target.value }))} autoComplete="off" /></Field>
            <Field id="googleRedirectUri" label="Redirect URI"><input id="googleRedirectUri" value={oauth.redirectUri} readOnly type="url" /></Field>
            <div className="actions">
              <IconButton className="primary" icon={<KeyRound />} aria-describedby="googleOAuthActionHelp">Sign in with Google</IconButton>
              <IconButton type="button" icon={<Check />} onClick={() => { setRequest(current => ({ ...current, authType: "bearer", authToken: "{{google_access_token}}" })); announce("Authorization will use google_access_token.", "ok"); }}>Use access token</IconButton>
            </div>
          </form>
          <p id="googleOAuthActionHelp" className="field-help">Sign in opens Google authentication in the current tab. Add this redirect URI to the Google OAuth client. Tokens are saved as variables after sign-in.</p>
        </section>
        )}
      </main>
    </>
  );
}


createRoot(document.getElementById("root")).render(<App />);
