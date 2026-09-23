import React from 'react';

/**
 * Mosslight studio splash / game loading screen. Fills the window.
 *
 *   <SplashScreen onDone={() => setReady(true)} />
 *   <SplashScreen mode="loading" gameTitle="__TITLE__" subtitle="__SUBTITLE__" progress={62}
 *                 tip="Tip: lanterns on the pier keep the Drowned from reaching Main Street." />
 *
 * `progress` left undefined shows an indeterminate bar. Needs brand.css on the page and the
 * brand PNGs at `assets/` (change ASSETS below if they live somewhere else).
 */
const ASSETS = 'assets/';

export function SplashScreen({
  mode = 'splash', gameTitle, subtitle, tip, progress,
  presents = 'Mosslight Studios presents', theme, holdMs = 1900, fadeMs = 600,
  onDone, fixed = true, onClick, style,
}) {
  const [fade, setFade] = React.useState(false);
  React.useEffect(() => {
    if (mode !== 'splash') return undefined;
    const t1 = setTimeout(() => setFade(true), holdMs);
    const t2 = setTimeout(() => onDone && onDone(), holdMs + fadeMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [mode, holdMs, fadeMs, onDone]);

  const dismiss = () => { if (onClick) onClick(); setFade(true); setTimeout(() => onDone && onDone(), fadeMs); };
  const loading = mode === 'loading';

  return (
    <div data-theme={theme} onClick={dismiss} style={{
      position: fixed ? 'fixed' : 'absolute', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center',
      background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-ui)', overflow: 'hidden',
      opacity: fade ? 0 : 1, transition: `opacity ${fadeMs}ms ease`, pointerEvents: fade ? 'none' : 'auto', ...style,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: loading ? 18 : 26, padding: 24, textAlign: 'center', maxWidth: 'min(90vw, 900px)', animation: 'ml-rise var(--dur-splash-in) ease' }}>
        <img
          src={ASSETS + 'mosslight-logo.png'}
          alt="Mosslight"
          style={{ height: loading ? 'min(30vh, 260px)' : 'min(46vh, 380px)', width: 'auto', display: 'block', animation: loading ? 'ml-glow 2.4s ease-in-out infinite' : undefined, filter: loading ? undefined : 'drop-shadow(0 30px 60px rgba(0,0,0,.45))' }}
        />
        {loading ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 'var(--tracking-brand)', textTransform: 'uppercase', color: 'var(--accent)' }}>{presents}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 600, lineHeight: 1, letterSpacing: '-.01em' }}>{gameTitle}</div>
            {subtitle && <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'clamp(16px, 2vw, 24px)', color: 'var(--text-2)', marginTop: -6 }}>{subtitle}</div>}
            <div style={{ width: 'min(60vw, 420px)', height: 3, borderRadius: 2, background: 'var(--line-2)', overflow: 'hidden', marginTop: 10 }}>
              <div style={{ height: '100%', width: (progress == null ? 40 : progress) + '%', background: 'var(--accent)', transition: 'width .4s var(--ease)', animation: progress == null ? 'ml-blink 1.4s infinite' : undefined }} />
            </div>
            {tip && <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 520, lineHeight: 1.5 }}>{tip}</div>}
          </>
        ) : (
          <>
            <img src={ASSETS + 'mosslight-wordmark-full.png'} alt="Mosslight Studios" style={{ height: 'min(14vh, 120px)', maxWidth: '86vw', width: 'auto', display: 'block', objectFit: 'contain' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {[0, 0.2, 0.4].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `ml-blink 1.2s ${d}s infinite` }} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SplashScreen;
