import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, IconButton, PanelList, ConfirmPrompt } from "../components.jsx";

export function WorkspacePanel({ workspaces, activeWorkspaceId, activeWorkspace, workspaceDraft, setWorkspaceDraft, pendingConfirm, resolveConfirm, switchWorkspace, createWorkspace, deleteWorkspace }) {
  return (
    <PanelList title="Workspace">
      <section className="settings-section" aria-labelledby="workspaceSwitchTitle">
        <h3 id="workspaceSwitchTitle">Workspaces</h3>
        <div className="settings-group">
          <Field id="workspaceSelect" label="Switch workspace">
            <select id="workspaceSelect" value={activeWorkspaceId} onChange={e => { void switchWorkspace(e.target.value); }}>
              {workspaces.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="workspaceManageTitle">
        <h3 id="workspaceManageTitle">Manage Workspaces</h3>
        <form className="workspace-create" aria-label="Create new workspace" onSubmit={createWorkspace}>
          <Field id="workspaceName" label="New workspace name">
            <input id="workspaceName" value={workspaceDraft} onChange={e => setWorkspaceDraft(e.target.value)} autoComplete="off" placeholder="Workspace name" />
          </Field>
          <div className="workspace-actions">
            <IconButton type="submit" icon={<Plus />}>Create workspace</IconButton>
            <IconButton type="button" icon={<Trash2 />} disabled={activeWorkspaceId === "default"} aria-label={`Delete workspace ${activeWorkspace.name}`} onClick={() => { void deleteWorkspace(activeWorkspaceId); }}>Delete active</IconButton>
            <ConfirmPrompt pending={pendingConfirm} id="delete-workspace" onResolve={resolveConfirm} />
          </div>
        </form>
        <p className="settings-note">The Default workspace cannot be deleted. Deleting a workspace permanently removes all of its saved requests, history, environments, and mocks.</p>
      </section>
    </PanelList>
  );
}
