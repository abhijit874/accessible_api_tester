import React from "react";
import { Save } from "lucide-react";
import { Field, IconButton, PanelList } from "../components.jsx";

export function EnvironmentsPanel({ profiles, activeProfileId, profileNameDraft, setProfileNameDraft, applyProfile, saveProfile, deleteProfile }) {
  return (
    <PanelList title="Environments">
      <p className="profiles-empty">Save the current variable set as a named profile to switch quickly between dev, staging, and prod environments.</p>
      <form className="profile-form" aria-label="Save profile" onSubmit={saveProfile}>
        <Field id="profileName" label="Profile name">
          <input id="profileName" value={profileNameDraft} onChange={e => setProfileNameDraft(e.target.value)} autoComplete="off" placeholder="e.g. Development" />
        </Field>
        <IconButton icon={<Save />}>Save current vars as profile</IconButton>
      </form>
      <h3 className="environments-list-heading">
        Saved profiles
        {activeProfileId && profiles.find(p => p.id === activeProfileId) && (
          <span className="active-profile-label"> — {profiles.find(p => p.id === activeProfileId).name} active</span>
        )}
      </h3>
      {profiles.length ? (
        <ol className="history-list profile-list">
          {profiles.map(profile => (
            <li key={profile.id} className={`saved-row${activeProfileId === profile.id ? " profile-active" : ""}`}>
              <button type="button" onClick={() => applyProfile(profile)} aria-pressed={activeProfileId === profile.id}>
                {profile.name}
                <span className="profile-meta">{profile.variables.length} var{profile.variables.length === 1 ? "" : "s"}</span>
              </button>
              <button type="button" className="danger-button" aria-label={`Delete profile ${profile.name}`} onClick={() => deleteProfile(profile.id)}>Delete</button>
            </li>
          ))}
        </ol>
      ) : <p className="profiles-empty">No profiles saved yet. Add variables in the Variables tab, then save them as a named profile above.</p>}
    </PanelList>
  );
}
