import React from "react";
import { Field, PanelList } from "../components.jsx";

export function SettingsPanel({ ignoreSslErrors, setIgnoreSslErrors, proxyUrl, setProxyUrl, defaultTimeout, setDefaultTimeout, announce }) {
  return (
    <PanelList title="Settings">
      <section className="settings-section" aria-labelledby="settingsNetworkTitle">
        <h3 id="settingsNetworkTitle">Network</h3>
        <div className="settings-group">
          <label className={`ssl-toggle-label settings-ssl-toggle${ignoreSslErrors ? " ssl-toggle-active" : ""}`}>
            <input
              type="checkbox"
              checked={ignoreSslErrors}
              onChange={e => {
                setIgnoreSslErrors(e.target.checked);
                localStorage.setItem("accessible-api-tester-ignore-ssl", String(e.target.checked));
                announce(e.target.checked ? "SSL verification disabled." : "SSL verification enabled.", "ok");
              }}
            />
            Skip SSL verification
          </label>
          <div className="proxy-url-label settings-proxy-label">
            <span className="proxy-url-text">Proxy URL</span>
            <input
              type="url"
              className="proxy-url-input settings-proxy-input"
              placeholder="http://host:port"
              value={proxyUrl}
              aria-label="Proxy URL"
              onChange={e => {
                setProxyUrl(e.target.value);
                localStorage.setItem("accessible-api-tester-proxy-url", e.target.value);
              }}
            />
          </div>
          <Field id="settingsDefaultTimeout" label="Default timeout (seconds)">
            <input
              id="settingsDefaultTimeout"
              type="number"
              inputMode="numeric"
              min="1"
              value={defaultTimeout}
              onChange={e => {
                setDefaultTimeout(e.target.value);
                localStorage.setItem("accessible-api-tester-default-timeout", e.target.value);
              }}
              placeholder="None (no timeout)"
            />
          </Field>
        </div>
        <p className="settings-note">These settings apply globally to all requests. SSL and proxy can also be toggled in the Requests view.</p>
      </section>
    </PanelList>
  );
}
