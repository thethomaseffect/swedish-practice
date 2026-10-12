# Swedish Practice

Revise Swedish from your own notes. A session is about ten phrases, weighted toward the ones that are going badly. After each answer the pronunciation is shown, and you move on with Next.

The web app keeps phrases in the browser. The desktop app keeps them in a JSON file so notes added in this project stay on disk. A first visit starts from the tourist phrases in `data/phrases.json`.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. That is the web app.

The desktop app, pointed at `data/phrases.json` when you start it from this folder:

```bash
npm run dev:desktop
```

## Add phrases

Use the library form, or paste a photo of your notes into the agent in this project. The agent checks spelling and translation, reports anything it changes, adds a pronunciation, and writes `data/phrases.json`.

On the web app, use Import JSON for that same file. The desktop app reads the file directly and picks up changes.

Practice history is stored beside the phrases file as `phrases.stats.json` (or in the browser, for the web app). It is not part of the phrase list.

A phrase looks like this:

```json
{
  "id": "en-kaffe",
  "english": "a coffee",
  "swedish": "en kaffe",
  "phonetic": "ehn KAF-feh",
  "notes": "",
  "createdAt": "2026-10-12T00:00:00.000Z",
  "updatedAt": "2026-10-12T00:00:00.000Z"
}
```

Separate real alternatives with ` / `, for example `hej / hejsan`.

## Site and downloads

Pushing `main` runs `.github/workflows/pages.yml`, which publishes the web app with GitHub Pages. The Downloads page links to desktop installers.

Installers are built when a version tag is pushed, for example `v0.1.0`. Match the tag to `version` in `package.json` before tagging. The workflow publishes Windows, macOS, and Linux builds to GitHub releases.
