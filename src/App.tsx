import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { parsePairingLink } from './sync/engine';
import { useHub } from './core/store';
import { platform } from './platform';
import { Companion } from './mobile/Companion';
import { Assets } from './ui/Assets';
import { ChatRail } from './ui/Chat';
import { Modal, RichText, Splash, Toast, UpdateBanner, useUpdate } from './ui/common';
import { Header, Library, NewProject } from './ui/Library';
import { Project } from './ui/Project';
import { Integrations, Settings } from './ui/Settings';

export default function App() {
  const hub = useHub();
  const { ui, proj, settings } = hub;
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const upd = useUpdate();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.body.style.background = settings.theme === 'dark' ? '#0d0f0d' : '#f3eee2';
  }, [settings.theme]);

  // Phone pairing: scanning the desktop's QR code opens mosslight://pair#… in this app.
  const { connectSync } = hub;
  useEffect(() => {
    if (platform !== 'android') return;
    const pair = (url?: string) => { const c = url ? parsePairingLink(url) : null; if (c) void connectSync(c); };
    void CapApp.getLaunchUrl().then(r => pair(r?.url)).catch(() => {});
    const h = CapApp.addListener('appUrlOpen', e => pair(e.url));
    return () => { void h.then(x => x.remove()); };
  }, [connectSync]);

  // ⌘K / Ctrl+K focuses chat, ⌘, / Ctrl+, opens Settings.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === ',') { e.preventDefault(); setShowSettings(true); }
      if (e.key.toLowerCase() === 'k') { e.preventDefault(); hub.patchUi({ chatOpen: true }); setTimeout(() => document.querySelector<HTMLTextAreaElement>('aside textarea')?.focus(), 30); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [hub]);

  const banner = upd.update && !dismissed ? <UpdateBanner u={upd.update} onDismiss={() => setDismissed(true)} onNotes={() => setNotes(true)} /> : null;
  const overlays = (
    <>
      {showNew && <NewProject hub={hub} onClose={() => setShowNew(false)} />}
      {showSettings && <Settings hub={hub} onClose={() => setShowSettings(false)} />}
      {notes && upd.update && (
        <Modal width={560} onClose={() => setNotes(false)}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>What's new in {upd.update.version}</h2>
          <RichText text={upd.update.notes || 'No release notes.'} style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text-2)' }} />
        </Modal>
      )}
    </>
  );

  if (platform === 'android') {
    return (
      <>
        <Companion hub={hub} onSettings={() => setShowSettings(true)} onNew={() => setShowNew(true)} banner={banner} />
        <div data-theme={settings.theme}>{overlays}</div>
      </>
    );
  }

  return (
    <div className="app" data-theme={settings.theme}>
      <div>{banner}</div>
      <Header hub={hub} onSettings={() => setShowSettings(true)} />
      <div style={{ display: 'grid', gridTemplateColumns: ui.chatOpen ? 'minmax(0,1fr) clamp(300px, 32vw, 400px)' : 'minmax(0,1fr)', minHeight: 0 }}>
        <main className="main">
          {ui.view === 'library' && <Library hub={hub} onNew={() => setShowNew(true)} onSettings={() => setShowSettings(true)} />}
          {ui.view === 'assets' && <Assets hub={hub} />}
          {ui.view === 'integrations' && <Integrations hub={hub} />}
          {ui.view === 'project' && proj && <Project key={proj.id} hub={hub} p={proj} />}
          {ui.view === 'project' && !proj && <Library hub={hub} onNew={() => setShowNew(true)} onSettings={() => setShowSettings(true)} />}
        </main>
        {ui.chatOpen && <ChatRail hub={hub} />}
      </div>
      {overlays}
      <Toast text={ui.toast} />
      <Splash />
    </div>
  );
}
