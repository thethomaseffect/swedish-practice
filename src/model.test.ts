import { describe, expect, it } from "vitest";
import {
  answersMatch,
  applyImport,
  emptyState,
  mergePhrases,
  parsePhrasesJson,
  pickSession,
  recordAttempt,
  serializePhrases,
  SESSION_SIZE,
  troubleWeight,
} from "./model";
import type { Phrase, PhraseStats } from "./types";

function phrase(id: string, swedish = id, english = id): Phrase {
  return {
    id,
    english,
    swedish,
    phonetic: "FON-et-ik",
    notes: "",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
  };
}

describe("answersMatch", () => {
  it("ignores case, spacing, and trailing punctuation", () => {
    expect(answersMatch("Vad heter du?", "  vad   heter du ")).toBe(true);
    expect(answersMatch("Jag är trött.", "jag är trött")).toBe(true);
  });

  it("keeps Swedish vowels distinct", () => {
    expect(answersMatch("Jag är trött.", "jag ar trott")).toBe(false);
  });

  it("accepts alternatives separated by a slash or pipe", () => {
    expect(answersMatch("hej / hejsan", "hejsan")).toBe(true);
    expect(answersMatch("hello | hi", "hello")).toBe(true);
    expect(answersMatch("hej / hejsan", "tjena")).toBe(false);
  });
});

describe("troubleWeight", () => {
  it("ranks repeated misses above new phrases, and new phrases above settled ones", () => {
    const missed: PhraseStats = {
      attempts: 4,
      correct: 0,
      incorrect: 4,
      streak: -4,
      lastResult: "incorrect",
      lastSeenAt: "2026-10-12T00:00:00.000Z",
    };
    const steady: PhraseStats = {
      attempts: 6,
      correct: 6,
      incorrect: 0,
      streak: 6,
      lastResult: "correct",
      lastSeenAt: "2026-10-12T00:00:00.000Z",
    };
    expect(troubleWeight(missed)).toBeGreaterThan(troubleWeight(undefined));
    expect(troubleWeight(undefined)).toBeGreaterThan(troubleWeight(steady));
  });
});

describe("pickSession", () => {
  it("returns a short unique session and leaves the library in place", () => {
    const phrases = Array.from({ length: 15 }, (_, index) => phrase(`p${index}`));
    const session = pickSession(phrases, {}, SESSION_SIZE, () => 0.25);
    expect(session).toHaveLength(SESSION_SIZE);
    expect(new Set(session.map((item) => item.id)).size).toBe(SESSION_SIZE);
    expect(phrases).toHaveLength(15);
  });

  it("uses every phrase when the library is smaller than a session", () => {
    const phrases = [phrase("a"), phrase("b"), phrase("c")];
    expect(pickSession(phrases, {}, SESSION_SIZE)).toHaveLength(3);
  });

  it("draws struggling phrases more often", () => {
    const phrases = [phrase("steady"), phrase("trouble")];
    const stats = {
      steady: {
        attempts: 8,
        correct: 8,
        incorrect: 0,
        streak: 8,
        lastResult: "correct" as const,
        lastSeenAt: "2026-10-12T00:00:00.000Z",
      },
      trouble: {
        attempts: 5,
        correct: 0,
        incorrect: 5,
        streak: -5,
        lastResult: "incorrect" as const,
        lastSeenAt: "2026-10-12T00:00:00.000Z",
      },
    };
    let troublePicks = 0;
    for (let i = 0; i < 300; i += 1) {
      const [card] = pickSession(phrases, stats, 1);
      if (card.id === "trouble") troublePicks += 1;
    }
    expect(troublePicks).toBeGreaterThan(240);
  });
});

describe("recordAttempt", () => {
  it("tracks streaks in both directions", () => {
    const once = recordAttempt(undefined, false, "2026-10-12T00:00:00.000Z");
    const twice = recordAttempt(once, false, "2026-10-12T00:01:00.000Z");
    const recovered = recordAttempt(twice, true, "2026-10-12T00:02:00.000Z");
    expect(twice.streak).toBe(-2);
    expect(twice.incorrect).toBe(2);
    expect(recovered.streak).toBe(1);
    expect(recovered.correct).toBe(1);
    expect(recovered.attempts).toBe(3);
  });
});

describe("mergePhrases", () => {
  it("keeps the existing id when the wording already exists", () => {
    const existing = [phrase("original", "en kaffe", "a coffee")];
    const incoming = [phrase("new-id", "en kaffe", "a coffee")];
    incoming[0].phonetic = "ehn KAF-feh";
    const merged = mergePhrases(existing, incoming, "2026-10-12T12:00:00.000Z");
    expect(merged.updated).toBe(1);
    expect(merged.phrases).toHaveLength(1);
    expect(merged.phrases[0].id).toBe("original");
    expect(merged.phrases[0].phonetic).toBe("ehn KAF-feh");
    expect(merged.phrases[0].createdAt).toBe(existing[0].createdAt);
  });

  it("appends genuinely new phrases", () => {
    const merged = mergePhrases([phrase("a")], [phrase("b")], "2026-10-12T12:00:00.000Z");
    expect(merged.added).toBe(1);
    expect(merged.phrases.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("phrases file", () => {
  it("round-trips and rejects duplicate ids", () => {
    const raw = serializePhrases([phrase("vad-heter-du", "Vad heter du?", "What is your name?")]);
    expect(raw.endsWith("\n")).toBe(true);
    expect(parsePhrasesJson(raw)[0].swedish).toBe("Vad heter du?");
    expect(() =>
      parsePhrasesJson(
        JSON.stringify({
          version: 1,
          phrases: [phrase("same"), phrase("same")],
        }),
      ),
    ).toThrow(/Duplicate phrase id/);
  });

  it("imports phrases without dropping practice history for other ids", () => {
    const state = emptyState();
    state.phrases = [phrase("keep")];
    state.stats.keep = recordAttempt(undefined, true, "2026-10-12T00:00:00.000Z");
    const imported = applyImport(
      state,
      JSON.stringify({
        version: 1,
        phrases: [phrase("fresh", "hej", "hi")],
      }),
    );
    expect(imported.added).toBe(1);
    expect(imported.state.stats.keep.correct).toBe(1);
    expect(imported.state.phrases.map((item) => item.id)).toEqual(["keep", "fresh"]);
  });
});
