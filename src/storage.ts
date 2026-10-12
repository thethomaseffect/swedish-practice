import { emptyState, parsePhrasesJson, parseStatsJson, serializeBackup, serializePhrases, serializeStats } from "./model";
import { seedPhrases } from "./seed";
import type { AppState } from "./types";

export type StorageInfo = {
  mode: "web" | "desktop";
  phrasesPath: string | null;
  statsPath: string | null;
};

export type LoadResult =
  | { ok: true; state: AppState; info: StorageInfo }
  | { ok: false; error: string; info: StorageInfo };

const WEB_KEY = "swedish-practice";

export function isDesktop(): boolean {
  return typeof window.swedishPractice !== "undefined";
}

function webInfo(): StorageInfo {
  return { mode: "web", phrasesPath: null, statsPath: null };
}

function desktopInfo(snapshot?: { phrasesPath?: string; statsPath?: string }): StorageInfo {
  return {
    mode: "desktop",
    phrasesPath: snapshot?.phrasesPath ?? null,
    statsPath: snapshot?.statsPath ?? null,
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function stateFromTexts(phrasesJson: string | null, statsJson: string | null): AppState {
  const phrases = phrasesJson == null ? seedPhrases() : parsePhrasesJson(phrasesJson);
  if (statsJson == null) return { ...emptyState(), phrases };
  const parsed = parseStatsJson(statsJson);
  return { phrases, stats: parsed.stats, settings: parsed.settings };
}

function parseWeb(raw: string | null): LoadResult {
  if (raw == null) return { ok: true, state: { ...emptyState(), phrases: seedPhrases() }, info: webInfo() };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Browser data is not a phrases file.");
    }
    const record = parsed as { phrases?: unknown; stats?: unknown; settings?: unknown };
    if (!Array.isArray(record.phrases)) throw new Error("Browser data is missing phrases.");
    const phrases = parsePhrasesJson(JSON.stringify({ version: 1, phrases: record.phrases }));
    const parsedStats = parseStatsJson(
      JSON.stringify({
        version: 1,
        settings: record.settings ?? { direction: "en-sv" },
        stats: record.stats ?? {},
      }),
    );
    return {
      ok: true,
      info: webInfo(),
      state: { phrases, stats: parsedStats.stats, settings: parsedStats.settings },
    };
  } catch (error) {
    return { ok: false, info: webInfo(), error: errorMessage(error, "Could not read browser storage.") };
  }
}

export async function loadState(): Promise<LoadResult> {
  if (!isDesktop()) return parseWeb(localStorage.getItem(WEB_KEY));
  let snapshot;
  try {
    snapshot = await window.swedishPractice!.read();
  } catch (error) {
    return { ok: false, info: desktopInfo(), error: errorMessage(error, "Could not read the phrases file.") };
  }
  try {
    return { ok: true, info: desktopInfo(snapshot), state: stateFromTexts(snapshot.phrasesJson, snapshot.statsJson) };
  } catch (error) {
    return { ok: false, info: desktopInfo(snapshot), error: errorMessage(error, "Could not read the phrases file.") };
  }
}

export async function saveState(state: AppState, writePhrases: boolean): Promise<void> {
  if (isDesktop()) {
    await window.swedishPractice!.write({
      phrasesJson: writePhrases ? serializePhrases(state.phrases) : null,
      statsJson: serializeStats(state.stats, state.settings),
    });
    return;
  }
  localStorage.setItem(WEB_KEY, serializeBackup(state));
}

export async function choosePhrasesFile(): Promise<{ canceled: true } | LoadResult> {
  const snapshot = await window.swedishPractice!.choose();
  if (snapshot.canceled) return { canceled: true };
  try {
    return { ok: true, info: desktopInfo(snapshot), state: stateFromTexts(snapshot.phrasesJson, snapshot.statsJson) };
  } catch (error) {
    return { ok: false, info: desktopInfo(snapshot), error: errorMessage(error, "Could not read the phrases file.") };
  }
}

export function revealPhrasesFile(): Promise<void> {
  return window.swedishPractice!.reveal();
}

export function watchPhrasesFile(callback: () => void): () => void {
  if (!isDesktop()) return () => undefined;
  window.swedishPractice!.subscribe(callback);
  return () => window.swedishPractice!.unsubscribe();
}

export function clearWebStorage(): void {
  localStorage.removeItem(WEB_KEY);
}
