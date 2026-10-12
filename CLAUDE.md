# Swedish Practice App

This is an Electron app used to revise Swedish. Notes are added by pasting photos of handwriting into the agent, which files the phrases. The app then builds revision sessions on demand and tracks how each phrase goes, bringing back the ones that cause trouble more often. GitHub Pages hosts the web app, which stores data in the browser, and a Downloads page for the desktop installers. The desktop app exists mainly so the phrases live in a JSON file on disk.

Phrases have English, Swedish, and a phonetic pronunciation. The pronunciation is hidden until the answer is checked, so it can be read aloud afterwards. You move on by pressing Next. A session is 10 phrases, or fewer when the library is smaller. Direction can be English to Swedish, Swedish to English, or a mix. The default is to type the Swedish.

When adding from the agent, confirm the Swedish spelling and the English translation. Report every change before saving: what was written, what was saved, and why. Do not invent phrases that are not in the notes. If a word is illegible, ask instead of guessing.

Write the pronunciation for an English speaker. Mark the stressed syllable in capitals. Use `aw` for å, `eh` for ä, `ur` for ö, `hw` for sj-sounds, and `sh` for tj-sounds. Example: `Jag skulle vilja ha en kaffe` → `yahg SKOOL-leh VIL-ya hah ehn KAF-feh`. Put genuine alternatives in the English or Swedish field separated by ` / `, for example `Pratar du engelska? / Talar du engelska?`.

Phrases live in `data/phrases.json`. Each one needs `id`, `english`, `swedish`, `phonetic`, `notes`, `createdAt`, and `updatedAt`. New ids are slugs such as `vad-heter-du`. When correcting a phrase that is already there, keep its id and `createdAt`, and refresh `updatedAt`. Do not drop other phrases, and do not edit `data/*.stats.json` or any other practice-history file. The desktop app reads `data/phrases.json` when started from this folder and reloads it when the file changes. On the web app, import that same JSON. The web app uses the file as its starting list only when the browser has no saved phrases yet.

The file already contains a starter set of tourist phrases (greetings, getting around, food, and asking for help), tagged `Tourist phrases` in `notes`.

The app is client-side React. Practice runs a session. Review lists every phrase with its pronunciation and how it has been going. Reloading keeps the section you were on and how far down the page you had scrolled. Library is where phrases are added, edited, imported, and exported. Practice history is stored beside the phrases file as `phrases.stats.json` on disk, or in local storage on the web. Pushing `main` publishes the site with GitHub Pages. Desktop installers are built when a `v*` tag that matches `package.json` is pushed.
