# Ward 7, Bay B: medication training simulation

A 3D hospital bay you can look around, with a working ward computer and two guided scenarios:
recording a heart rate, and giving paracetamol with wristband and medicine scanning.

All patient details are fictional. The NHS number is from the 999 range that NHS England
reserves for testing and never issues to real patients.

## Run it locally
Open `index.html` in Chrome, Edge or Safari. No server or install needed.

## Put it online
This folder is a static site: upload it as it is.

- **GitHub Pages:** push this folder to a repository, then in the repository go to
  Settings → Pages, choose *Deploy from a branch*, select `main` and `/ (root)`.
  The site appears at `https://<username>.github.io/<repository>/`.
- **Cloudflare Pages or Netlify:** connect the GitHub repository. Leave the build command
  empty and set the output directory to `/`. Every push publishes a new version, and you
  can add a custom domain such as `training.example.co.uk`.

## Show it on a Webflow site
Add a button that links to the hosted URL (best for full screen), or a Code Embed element:

```html
<iframe src="https://YOUR-SITE-URL/" title="Ward 7 training simulation"
  style="width:100%;height:80vh;border:0;border-radius:12px" allow="fullscreen"></iframe>
```

## Edit it
The page is built from the files in `src/`:

| File | What it holds |
|---|---|
| `src/scene.js` | the 3D bay, camera and interactions |
| `src/train.js` | the scenarios, hints, feedback and debrief |
| `src/epr.js`, `src/epr.css` | the ward computer |
| `src/shell.html` | page layout and on-screen styles |

After changing anything in `src/`, run `python3 build.py` to rebuild `index.html`.

## What it loads from outside
Only the Atkinson Hyperlegible font from Google Fonts. If that's blocked, the page falls back
to the system font. three.js r147 is bundled in `vendor/three` (MIT licence).
