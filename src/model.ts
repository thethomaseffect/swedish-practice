import type { AppState, Direction, Phrase, PhraseStats, PromptDirection, Settings } from "./types";

export const SESSION_SIZE = 10;

const PHRASE_KEYS = ["id", "english", "swedish", "phonetic", "notes", "createdAt", "updatedAt"] as const;

export function emptyStats(): PhraseStats {
  return {
    attempts: 0,
    correct: 0,
    incorrect: 0,
    streak: 0,
    lastResult: null,
    lastSeenAt: null,
  };
}

export function emptyState(): AppState {
  return {
    phrases: [],
    stats: {},
    settings: { direction: "en-sv" },
  };
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("sv-SE")
    .replace(/[’‘ʼ]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?,;:…]+$/u, "")
    .trim();
}

export function answersMatch(expected: string, given: string): boolean {
  const attempt = normalizeAnswer(given);
  if (!attempt) return false;
  const options = expected
    .split(/\s*(?:\/|\|)\s*/)
    .map((option) => normalizeAnswer(option))
    .filter(Boolean);
  return options.includes(attempt);
}

export function troubleWeight(stats?: PhraseStats): number {
  if (!stats || stats.attempts === 0) return 2.2;
  const accuracy = stats.correct / stats.attempts;
  let weight = 0.35 + (1 - accuracy) * 3;
  if (stats.lastResult === "incorrect") weight += 1.6;
  if (stats.streak < 0) weight += Math.min(2, Math.abs(stats.streak) * 0.35);
  if (stats.streak >= 3 && accuracy >= 0.8) weight *= 0.45;
  return Math.max(0.2, weight);
}

export function troubleLabel(stats?: PhraseStats): "New" | "Needs work" | "Shaky" | "Steady" {
  if (!stats || stats.attempts === 0) return "New";
  const accuracy = stats.correct / stats.attempts;
  if (stats.lastResult === "incorrect" || accuracy < 0.6) return "Needs work";
  if (accuracy < 0.85 || stats.streak < 2) return "Shaky";
  return "Steady";
}

export function accuracyLabel(stats?: PhraseStats): string {
  if (!stats || stats.attempts === 0) return "Not practiced yet";
  const percent = Math.round((stats.correct / stats.attempts) * 100);
  const tries = stats.attempts === 1 ? "try" : "tries";
  return `${percent}% over ${stats.attempts} ${tries}`;
}

export function pickSession<T extends { id: string }>(
  phrases: readonly T[],
  stats: Record<string, PhraseStats | undefined>,
  size = SESSION_SIZE,
  rng: () => number = Math.random,
): T[] {
  const pool = [...phrases];
  const picked: T[] = [];
  const target = Math.min(size, pool.length);
  while (picked.length < target) {
    const weights = pool.map((phrase) => troubleWeight(stats[phrase.id]));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = rng() * total;
    let index = pool.length - 1;
    if (total > 0) {
      for (let i = 0; i < pool.length; i += 1) {
        cursor -= weights[i];
        if (cursor <= 0) {
          index = i;
          break;
        }
      }
    } else {
      index = 0;
    }
    const [phrase] = pool.splice(index, 1);
    picked.push(phrase);
  }
  return picked;
}

export function cardDirection(preference: Direction, rng: () => number = Math.random): PromptDirection {
  if (preference === "mix") return rng() < 0.5 ? "en-sv" : "sv-en";
  return preference;
}

export function recordAttempt(stats: PhraseStats | undefined, correct: boolean, now = new Date().toISOString()): PhraseStats {
  const current = stats ?? emptyStats();
  let streak = 1;
  if (correct) streak = current.streak > 0 ? current.streak + 1 : 1;
  else streak = current.streak < 0 ? current.streak - 1 : -1;
  return {
    attempts: current.attempts + 1,
    correct: current.correct + (correct ? 1 : 0),
    incorrect: current.incorrect + (correct ? 0 : 1),
    streak,
    lastResult: correct ? "correct" : "incorrect",
    lastSeenAt: now,
  };
}

function clean(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  return value.trim();
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function parsePhrase(value: unknown, index: number): Phrase {
  const record = asRecord(value, `Phrase ${index + 1}`);
  const phrase: Phrase = {
    id: clean(record.id, `Phrase ${index + 1} id`),
    english: clean(record.english, `Phrase ${index + 1} english`),
    swedish: clean(record.swedish, `Phrase ${index + 1} swedish`),
    phonetic: clean(record.phonetic, `Phrase ${index + 1} phonetic`),
    notes: typeof record.notes === "string" ? record.notes.trim() : "",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
  };
  if (!phrase.id) throw new Error(`Phrase ${index + 1} is missing an id.`);
  if (!phrase.english || !phrase.swedish || !phrase.phonetic) {
    throw new Error(`"${phrase.swedish || phrase.english || phrase.id}" needs English, Swedish, and a phonetic pronunciation.`);
  }
  return phrase;
}

export function parsePhrasesJson(raw: string): Phrase[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("phrases.json is not valid JSON.");
  }
  const record = asRecord(parsed, "phrases.json");
  if (record.version !== undefined && record.version !== 1) {
    throw new Error("phrases.json uses an unsupported version.");
  }
  if (!Array.isArray(record.phrases)) throw new Error("phrases.json needs a phrases array.");
  const phrases = record.phrases.map((phrase, index) => parsePhrase(phrase, index));
  const seen = new Set<string>();
  for (const phrase of phrases) {
    if (seen.has(phrase.id)) throw new Error(`Duplicate phrase id "${phrase.id}".`);
    seen.add(phrase.id);
  }
  return phrases;
}

function parseDirection(value: unknown): Direction {
  if (value === "sv-en" || value === "mix" || value === "en-sv") return value;
  return "en-sv";
}

function parseStatsEntry(value: unknown, id: string): PhraseStats {
  const record = asRecord(value, `Stats for ${id}`);
  const attempts = record.attempts;
  const correct = record.correct;
  const incorrect = record.incorrect;
  const streak = record.streak;
  if (
    typeof attempts !== "number" ||
    typeof correct !== "number" ||
    typeof incorrect !== "number" ||
    typeof streak !== "number"
  ) {
    throw new Error(`Stats for ${id} are incomplete.`);
  }
  const lastResult = record.lastResult;
  if (lastResult !== "correct" && lastResult !== "incorrect" && lastResult !== null) {
    throw new Error(`Stats for ${id} have an unknown last result.`);
  }
  const lastSeenAt = record.lastSeenAt;
  if (lastSeenAt !== null && typeof lastSeenAt !== "string") {
    throw new Error(`Stats for ${id} have an unknown last seen time.`);
  }
  return { attempts, correct, incorrect, streak, lastResult, lastSeenAt };
}

export function parseStatsJson(raw: string): { stats: Record<string, PhraseStats>; settings: Settings } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The stats file is not valid JSON.");
  }
  const record = asRecord(parsed, "stats");
  if (record.version !== undefined && record.version !== 1) {
    throw new Error("The stats file uses an unsupported version.");
  }
  const settingsRecord = record.settings && typeof record.settings === "object" ? (record.settings as Record<string, unknown>) : {};
  const stats: Record<string, PhraseStats> = {};
  if (record.stats !== undefined) {
    const statsRecord = asRecord(record.stats, "stats");
    for (const [id, entry] of Object.entries(statsRecord)) {
      stats[id] = parseStatsEntry(entry, id);
    }
  }
  return {
    stats,
    settings: { direction: parseDirection(settingsRecord.direction) },
  };
}

export function serializePhrases(phrases: readonly Phrase[]): string {
  const ordered = phrases.map((phrase) => {
    const entry: Record<(typeof PHRASE_KEYS)[number], string> = {
      id: phrase.id,
      english: phrase.english,
      swedish: phrase.swedish,
      phonetic: phrase.phonetic,
      notes: phrase.notes,
      createdAt: phrase.createdAt,
      updatedAt: phrase.updatedAt,
    };
    return entry;
  });
  return `${JSON.stringify({ version: 1, phrases: ordered }, null, 2)}\n`;
}

export function serializeStats(stats: Record<string, PhraseStats>, settings: Settings): string {
  return `${JSON.stringify({ version: 1, settings, stats }, null, 2)}\n`;
}

export function serializeBackup(state: AppState): string {
  return `${JSON.stringify(
    {
      version: 1,
      settings: state.settings,
      phrases: state.phrases,
      stats: state.stats,
    },
    null,
    2,
  )}\n`;
}

export function samePhraseText(left: Pick<Phrase, "english" | "swedish">, right: Pick<Phrase, "english" | "swedish">): boolean {
  return normalizeAnswer(left.english) === normalizeAnswer(right.english) && normalizeAnswer(left.swedish) === normalizeAnswer(right.swedish);
}

export function findEquivalent(phrases: readonly Phrase[], english: string, swedish: string): Phrase | undefined {
  return phrases.find((phrase) => samePhraseText(phrase, { english, swedish }));
}

function sameContent(left: Phrase, right: Phrase): boolean {
  return (
    left.english === right.english &&
    left.swedish === right.swedish &&
    left.phonetic === right.phonetic &&
    left.notes === right.notes
  );
}

export function mergePhrases(
  existing: readonly Phrase[],
  incoming: readonly Phrase[],
  now = new Date().toISOString(),
): { phrases: Phrase[]; added: number; updated: number; unchanged: number } {
  const phrases = existing.map((phrase) => ({ ...phrase }));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const phrase of incoming) {
    const byId = phrases.findIndex((item) => item.id === phrase.id);
    const index = byId >= 0 ? byId : phrases.findIndex((item) => samePhraseText(item, phrase));
    if (index >= 0) {
      const current = phrases[index];
      if (sameContent(current, phrase)) {
        unchanged += 1;
        continue;
      }
      phrases[index] = {
        ...current,
        english: phrase.english,
        swedish: phrase.swedish,
        phonetic: phrase.phonetic,
        notes: phrase.notes,
        updatedAt: now,
      };
      updated += 1;
      continue;
    }
    phrases.push({
      ...phrase,
      createdAt: phrase.createdAt || now,
      updatedAt: now,
    });
    added += 1;
  }
  return { phrases, added, updated, unchanged };
}

export function createPhrase(
  input: { english: string; swedish: string; phonetic: string; notes?: string },
  now = new Date().toISOString(),
): Phrase {
  const phrase = parsePhrase(
    {
      id: crypto.randomUUID(),
      english: input.english,
      swedish: input.swedish,
      phonetic: input.phonetic,
      notes: input.notes ?? "",
      createdAt: now,
      updatedAt: now,
    },
    0,
  );
  return phrase;
}

export function updatePhrase(
  phrase: Phrase,
  input: { english: string; swedish: string; phonetic: string; notes?: string },
  now = new Date().toISOString(),
): Phrase {
  const next = parsePhrase(
    {
      ...phrase,
      english: input.english,
      swedish: input.swedish,
      phonetic: input.phonetic,
      notes: input.notes ?? "",
    },
    0,
  );
  return {
    ...phrase,
    english: next.english,
    swedish: next.swedish,
    phonetic: next.phonetic,
    notes: next.notes,
    updatedAt: now,
  };
}

export type ImportSummary = {
  state: AppState;
  added: number;
  updated: number;
  unchanged: number;
};

export function applyImport(state: AppState, raw: string, now = new Date().toISOString()): ImportSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("That import is not valid JSON.");
  }
  const record = asRecord(parsed, "Import");
  if (record.version !== undefined && record.version !== 1) {
    throw new Error("That import uses an unsupported version.");
  }
  if (!Array.isArray(record.phrases)) throw new Error("The import needs a phrases array.");
  const incoming = record.phrases.map((phrase, index) => parsePhrase(phrase, index));
  const merged = mergePhrases(state.phrases, incoming, now);
  const stats = { ...state.stats };
  if (record.stats !== undefined) {
    const statsRecord = asRecord(record.stats, "Imported stats");
    for (const phrase of merged.phrases) {
      if (phrase.id in statsRecord) stats[phrase.id] = parseStatsEntry(statsRecord[phrase.id], phrase.id);
    }
  }
  const settingsRecord = record.settings && typeof record.settings === "object" ? (record.settings as Record<string, unknown>) : null;
  return {
    state: {
      phrases: merged.phrases,
      stats,
      settings: settingsRecord ? { direction: parseDirection(settingsRecord.direction) } : state.settings,
    },
    added: merged.added,
    updated: merged.updated,
    unchanged: merged.unchanged,
  };
}

export function importSummary({ added, updated, unchanged }: Pick<ImportSummary, "added" | "updated" | "unchanged">): string {
  return `Added ${added}, updated ${updated}, left ${unchanged} unchanged.`;
}
