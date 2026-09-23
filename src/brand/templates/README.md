# Mosslight loading screen — __TITLE__

Put here by Mosslight Game Hub. Everything the screen needs is in this folder.

| File | What it is |
| --- | --- |
| `loading.html` | The loading screen, ready to run. Open it in a browser to see it. |
| `SplashScreen.jsx` | The same screen as a React component — `mode="splash"` (studio splash) or `mode="loading"`. |
| `brand.css` | Mosslight tokens: colors (dark + `data-theme="light"` bone), fonts, the `ml-rise` / `ml-blink` / `ml-glow` animations. |
| `assets/` | Monogram, icon, script wordmark, full lockup — transparent PNGs. |

## The screen

Lantern monogram with a slow glow, `MOSSLIGHT STUDIOS PRESENTS` in tracked brass caps, the game title in
Cormorant Garamond, an italic subtitle, a 3px brass progress bar, and one tip in muted body text. Dark bone-on-forest
by default. Keep tips to one sentence.

## Wiring it up

**Web / HTML5 game** — show `loading.html` first (or in an iframe over the canvas) and drive it from your loader:

```js
window.mosslightLoading.progress(pct); // 0–100
window.mosslightLoading.done();        // fades it out
```

Until the game reports real progress the bar creeps on its own, so it never looks frozen.

**React / Electron / Tauri game** — import `SplashScreen.jsx`, keep `brand.css` on the page:

```jsx
<SplashScreen mode="loading" gameTitle="__TITLE__" progress={loaded} tip={tips[i]} />
```

**Unity** — a loading scene rebuilt from the same recipe: the monogram as a UI Image (pulse its color alpha or a
glow material), the title in a serif TMP font, a thin `Image` with `Filled`/`Horizontal` type as the bar, driven by
`AsyncOperation.progress`. `brand.css` has the exact colors; import the PNGs from `assets/` into `Assets/Art/Brand/`.

**Unreal** — a UMG loading widget: monogram in an Image with a material pulse, title in a serif font, a ProgressBar
tinted `#c9a961` on `#0d0f0d`, shown by a Level Streaming / async load handler.

**Godot** — a loading scene with a TextureRect for the monogram, Label with a serif theme, and a ProgressBar bound to
`ResourceLoader.load_threaded_get_status()`.

Any of the agents in the hub can do this for you — ask Codex, and it has this folder and the colors in its context.

## The palette

| Token | Dark | Light (bone) |
| --- | --- | --- |
| Background | `#0d0f0d` (radial to `#080908`) | `#f3eee2` |
| Text | `#efe6d3` | `#1f261c` |
| Accent (bar, "presents") | `#c9a961` brass | `#2f5a2b` forest |
| Muted (tips) | `#8f8672` | `#76705f` |
| Lantern glow | `#f2c14e` | `#f2c14e` |
