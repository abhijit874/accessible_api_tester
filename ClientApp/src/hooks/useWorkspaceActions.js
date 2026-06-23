import { createId, createRequestTab } from "../utils.js";

export function useWorkspaceActions(ctx) {
  const {
    workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId,
    workspaceDraft, setWorkspaceDraft,
    setHistoryPage, setCollectionPage, setCollectionResults, setRequestWorkspace,
    workspaceQuery, workspaceStorageKey, requestConfirm, announce,
  } = ctx;

  async function switchWorkspace(workspaceId, knownName) {
    const id = workspaceId || "default";
    if (id === activeWorkspaceId) return;
    setActiveWorkspaceId(id);
    setHistoryPage(cur => ({ ...cur, skip: 0 }));
    setCollectionPage(cur => ({ ...cur, skip: 0 }));
    setCollectionResults([]);
    const tab = createRequestTab();
    setRequestWorkspace({ tabs: [tab], activeId: tab.id });
    localStorage.setItem("accessible-api-tester-active-workspace", id);
    try {
      await fetch(workspaceQuery("/api/workspaces/active", id), { method: "PUT" });
      const name = knownName || workspaces.find(w => w.id === id)?.name || id;
      announce(`Switched to workspace ${name}.`, "ok");
    } catch (error) {
      announce(`${error.message} Workspace switch was saved in browser backup.`, "error", { speak: false });
    }
  }

  async function createWorkspace(event) {
    event.preventDefault();
    const name = workspaceDraft.trim();
    if (!name) { announce("Enter a workspace name.", "error"); return; }
    const saved = { id: createId(), name, updatedAt: new Date().toISOString() };
    const next = [saved, ...workspaces.filter(w => w.id !== saved.id)];
    setWorkspaces(next);
    localStorage.setItem("accessible-api-tester-workspaces", JSON.stringify(next));
    setWorkspaceDraft("");
    try {
      await fetch(workspaceQuery(`/api/workspaces/${encodeURIComponent(saved.id)}`), {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(saved)
      });
      await switchWorkspace(saved.id, name);
    } catch (error) {
      announce(`${error.message} Workspace was created in browser backup.`, "error", { speak: false });
    }
  }

  async function deleteWorkspace(workspaceId) {
    if (workspaceId === "default") { announce("The default workspace cannot be deleted.", "error"); return; }
    const target = workspaces.find(w => w.id === workspaceId);
    if (!target) return;
    requestConfirm("delete-workspace", `Delete workspace "${target.name}" and all of its saved data?`, async () => {
      const next = workspaces.filter(w => w.id !== workspaceId);
      setWorkspaces(next);
      localStorage.setItem("accessible-api-tester-workspaces", JSON.stringify(next));
      ["history","collections","environments","mocks","collection-variables","profiles","activeProfile","folder-settings"]
        .forEach(key => localStorage.removeItem(workspaceStorageKey(key, workspaceId)));
      try {
        await fetch(workspaceQuery(`/api/workspaces/${encodeURIComponent(workspaceId)}`), { method: "DELETE" });
        if (workspaceId === activeWorkspaceId) await switchWorkspace(next[0]?.id || "default");
      } catch (error) {
        announce(`${error.message} Workspace was removed from browser backup.`, "error", { speak: false });
      }
    });
  }

  return { switchWorkspace, createWorkspace, deleteWorkspace };
}
