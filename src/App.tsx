import { useCallback, useEffect, useRef, useState } from "react";
import { Downloads } from "./components/Downloads";
import { Library } from "./components/Library";
import { Practice } from "./components/Practice";
import { Review } from "./components/Review";
import { applyImport, importSummary, recordAttempt, serializePhrases } from "./model";
import {
  choosePhrasesFile,
  clearWebStorage,
  isDesktop,
  loadState,
  revealPhrasesFile,
  saveState,
  watchPhrasesFile,
  type StorageInfo,
} from "./storage";
import type { AppState, Direction, Phrase } from "./types";

type View = "practice" | "review" | "library" | "downloads";

export function App() {
  const desktop = isDesktop();
  const [view, setView] = useState<View>("practice");
  const [state, setState] = useState<AppState | null>(null);
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const stateRef = useRef<AppState | null>(null);
  const phrasesSnapshot = useRef("");
  const saving = useRef(0);
  const pendingReload = useRef(false);
  const reloadRef = useRef<() => Promise<void>>(async () => undefined);

  const applyLoaded = useCallback((next: AppState, nextInfo: StorageInfo) => {
    stateRef.current = next;
    phrasesSnapshot.current = serializePhrases(next.phrases);
    setState(next);
    setInfo(nextInfo);
    setLoadError(null);
  }, []);

  const reload = useCallback(async () => {
    const result = await loadState();
    if (result.ok) applyLoaded(result.state, result.info);
    else {
      stateRef.current = null;
      setState(null);
      setInfo(result.info);
      setLoadError(result.error);
    }
  }, [applyLoaded]);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    void reload();
    return watchPhrasesFile(() => {
      if (saving.current > 0) {
        pendingReload.current = true;
        return;
      }
      void reloadRef.current();
    });
  }, [reload]);

  async function persist(next: AppState) {
    saving.current += 1;
    try {
      const phrasesJson = serializePhrases(next.phrases);
      await saveState(next, phrasesJson !== phrasesSnapshot.current);
      phrasesSnapshot.current = phrasesJson;
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      saving.current -= 1;
      if (saving.current === 0 && pendingReload.current) {
        pendingReload.current = false;
        await reloadRef.current();
      }
    }
  }

  function commit(recipe: (current: AppState) => AppState) {
    const current = stateRef.current;
    if (!current || loadError) return;
    const next = recipe(current);
    stateRef.current = next;
    setState(next);
    void persist(next);
  }

  function importJson(raw: string): string {
    const current = stateRef.current;
    if (!current) throw new Error("Phrases are still loading.");
    const result = applyImport(current, raw);
    stateRef.current = result.state;
    setState(result.state);
    void persist(result.state);
    return importSummary(result);
  }

  async function changeFile() {
    const result = await choosePhrasesFile();
    if ("canceled" in result) return;
    if (result.ok) applyLoaded(result.state, result.info);
    else {
      stateRef.current = null;
      setState(null);
      setInfo(result.info);
      setLoadError(result.error);
    }
  }

  const views: [View, string][] = desktop
    ? [
        ["practice", "Practice"],
        ["review", "Review"],
        ["library", "Library"],
      ]
    : [
        ["practice", "Practice"],
        ["review", "Review"],
        ["library", "Library"],
        ["downloads", "Downloads"],
      ];

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-kicker">Svenska</span>
          Swedish Practice
        </div>
        <nav className="nav" aria-label="Sections">
          {views.map(([id, label]) => (
            <button key={id} type="button" className={view === id ? "active" : undefined} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      {saveError && (
        <p className="error" role="alert">
          {saveError}
        </p>
      )}
      {loadError ? (
        <section className="panel">
          <p className="eyebrow">Phrases file</p>
          <h2>Could not open the phrases</h2>
          <p className="lead">{loadError}</p>
          {info?.phrasesPath && <p className="path">{info.phrasesPath}</p>}
          <div className="button-row">
            <button type="button" className="primary" onClick={() => void reload()}>
              Try again
            </button>
            {info?.mode === "desktop" && (
              <button type="button" className="secondary" onClick={() => void revealPhrasesFile()}>
                Show file
              </button>
            )}
            {info?.mode === "web" && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  clearWebStorage();
                  void reload();
                }}
              >
                Clear browser data
              </button>
            )}
          </div>
        </section>
      ) : !state || !info ? (
        <p className="lead">Loading phrases…</p>
      ) : (
        <>
          <div hidden={view !== "practice"}>
            <Practice
              phrases={state.phrases}
              stats={state.stats}
              direction={state.settings.direction}
              onDirection={(direction: Direction) =>
                commit((current) => ({ ...current, settings: { ...current.settings, direction } }))
              }
              onResult={(phraseId, correct) =>
                commit((current) => ({
                  ...current,
                  stats: { ...current.stats, [phraseId]: recordAttempt(current.stats[phraseId], correct) },
                }))
              }
              onOpenLibrary={() => setView("library")}
            />
          </div>
          <div hidden={view !== "review"}>
            <Review phrases={state.phrases} stats={state.stats} />
          </div>
          <div hidden={view !== "library"}>
            <Library
              state={state}
              info={info}
              onAdd={(phrase: Phrase) => commit((current) => ({ ...current, phrases: [...current.phrases, phrase] }))}
              onUpdate={(phrase) =>
                commit((current) => ({
                  ...current,
                  phrases: current.phrases.map((item) => (item.id === phrase.id ? phrase : item)),
                }))
              }
              onDelete={(id) =>
                commit((current) => {
                  const stats = { ...current.stats };
                  delete stats[id];
                  return { ...current, phrases: current.phrases.filter((phrase) => phrase.id !== id), stats };
                })
              }
              onImport={importJson}
              onChooseFile={() => void changeFile()}
              onRevealFile={() => void revealPhrasesFile()}
              onReload={() => void reload()}
            />
          </div>
          {!desktop && (
            <div hidden={view !== "downloads"}>
              <Downloads />
            </div>
          )}
        </>
      )}
      {!desktop && (
        <footer className="footer">Phrases in this browser stay on this device. The desktop app keeps them in a JSON file.</footer>
      )}
    </div>
  );
}
