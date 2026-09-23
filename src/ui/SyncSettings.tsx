import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import type { Hub } from '../core/store';
import { ago } from '../core/util';
import { copyText, openExternal, platform } from '../platform';
import { OS_LABEL, deviceId, getDeviceName, setDeviceName } from '../sync/device';
import { DEFAULT_SYNC_REPO, pairingLink, parsePairingLink } from '../sync/engine';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function SyncSettings({ hub }: { hub: Hub }) {
  const { syncState, syncConfig } = hub;
  const [repo, setRepo] = useState(DEFAULT_SYNC_REPO);
  const [token, setToken] = useState('');
  const [link, setLink] = useState('');
  const [name, setName] = useState(getDeviceName());
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick(n => n + 1), 5000); return () => window.clearInterval(t); }, []);

  const connect = async (cfg: { repo: string; token: string }) => {
    setBusy(true);
    await hub.connectSync({ repo: cfg.repo.trim(), token: cfg.token.trim() });
    setBusy(false);
  };
  const fromLink = () => {
    const c = parsePairingLink(link);
    if (!c) return hub.toast('That doesn\'t look like a Mosslight pairing link');
    void connect(c);
  };
  const scan = async () => {
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        hub.toast('Downloading Google\'s QR scanner — try again in a moment');
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        return;
      }
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const c = barcodes[0]?.rawValue ? parsePairingLink(barcodes[0].rawValue) : null;
      if (!c) return hub.toast('That QR code isn\'t a Mosslight pairing code');
      await connect(c);
    } catch (e) {
      hub.toast('Scanner unavailable: ' + ((e as Error)?.message || e) + ' — paste the pairing link instead');
    }
  };
  const showQr = async () => {
    if (!syncConfig) return;
    setQr(qr ? null : await QRCode.toDataURL(pairingLink(syncConfig), { margin: 1, width: 220, color: { dark: '#12140f', light: '#ffffff' } }));
  };

  const status = syncState.status === 'ok' ? `Synced ${ago(syncState.at)}` : syncState.status === 'connecting' ? 'Connecting…' : syncState.status === 'error' ? syncState.message : 'Off';
  const statusColor = syncState.status === 'ok' ? 'var(--green)' : syncState.status === 'error' ? 'var(--danger)' : 'var(--muted)';
  const devices = Object.entries(hub.data.devices || {}).sort((a, b) => b[1].lastSeen - a[1].lastSeen);

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Sync across devices</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span className="row" style={{ gap: 6, fontSize: 12, fontWeight: 600, color: statusColor }}><span className="dot" style={{ width: 7, height: 7, background: statusColor }} />{status}</span>
          {syncConfig && <span className="mono ellipsis" style={{ fontSize: 10, color: 'var(--muted)' }}>{syncConfig.repo}</span>}
        </div>

        {!syncConfig ? (
          <>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Projects, tasks, chat, art and builds are shared through a private GitHub repo. Every device sees the same library; each build still only launches on its own platform.
            </p>
            {platform === 'android' && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Easiest: on your computer open Settings → Pair a phone, then scan the QR code here.</div>
                <button className="btn-accent" style={{ minHeight: 44 }} disabled={busy} onClick={() => void scan()}>Scan pairing QR code</button>
                <div className="row">
                  <input className="input mono" style={{ fontSize: 11, padding: '8px 10px' }} value={link} onChange={e => setLink(e.target.value)} placeholder="…or paste a pairing link (mosslight://pair#…)" />
                  <button className="btn" style={{ fontSize: 12, padding: '8px 12px' }} disabled={busy || !link.trim()} onClick={fromLink}>Pair</button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Or connect manually:</div>
              </>
            )}
            <input className="input mono" style={{ fontSize: 12, padding: '8px 10px' }} value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo" />
            <input className="input mono" style={{ fontSize: 12, padding: '8px 10px' }} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="GitHub token (github_pat_…)" />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <button className="link" onClick={() => void openExternal(TOKEN_URL)}>Create a token on GitHub →</button>
              <button className="btn-accent" style={{ padding: '7px 12px', fontSize: 12 }} disabled={busy || !repo.trim() || !token.trim()} onClick={() => void connect({ repo, token })}>{busy ? 'Connecting…' : 'Turn on sync'}</button>
            </div>
            {platform !== 'android' && (
              <div className="row" style={{ gap: 6 }}>
                <input className="input mono" style={{ fontSize: 11, padding: '7px 10px' }} value={link} onChange={e => setLink(e.target.value)} placeholder="Already set up on another computer? Paste its pairing link" />
                <button className="btn" style={{ fontSize: 12, padding: '7px 12px' }} disabled={busy || !link.trim()} onClick={fromLink}>Pair</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>This device</span>
              <input className="input" style={{ fontSize: 12, padding: '6px 10px' }} value={name} onChange={e => setName(e.target.value)} onBlur={() => { setDeviceName(name); hub.setData(d => ({ ...d, devices: { ...(d.devices || {}), [deviceId]: { ...(d.devices?.[deviceId] || { os: 'web', lastSeen: Date.now() }), name: getDeviceName(), lastSeen: Date.now() } } })); }} />
            </div>
            {devices.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {devices.map(([id, d]) => (
                  <div key={id} className="row" style={{ fontSize: 12, justifyContent: 'space-between' }}>
                    <span>{d.name}{id === deviceId ? ' (this one)' : ''}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{OS_LABEL[d.os]} · seen {ago(d.lastSeen)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="row wrap" style={{ gap: 6 }}>
              {platform !== 'android' && <button className="btn-accent" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => void showQr()}>{qr ? 'Hide QR code' : 'Pair a phone'}</button>}
              <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => void copyText(pairingLink(syncConfig)).then(ok => hub.toast(ok ? 'Pairing link copied — it contains your sync token, keep it private' : 'Couldn\'t copy'))}>Copy pairing link</button>
              <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12, marginLeft: 'auto' }} onClick={() => void hub.disconnectSync()}>Turn off on this device</button>
            </div>
            {qr && (
              <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
                <img src={qr} alt="Pairing QR code" width={160} height={160} style={{ borderRadius: 8, flex: 'none' }} />
                <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  1. Install the Mosslight APK on the phone.<br />2. In Mosslight on the phone: ⚙ → Scan pairing QR code.<br />3. Point it at this code — the phone syncs right away.<br /><br />This code contains your sync token — only show it to your own devices.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
