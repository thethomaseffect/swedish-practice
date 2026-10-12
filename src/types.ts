export type Direction = "en-sv" | "sv-en" | "mix";

export type PromptDirection = "en-sv" | "sv-en";

export type Phrase = {
  id: string;
  english: string;
  swedish: string;
  phonetic: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type PhraseStats = {
  attempts: number;
  correct: number;
  incorrect: number;
  streak: number;
  lastResult: "correct" | "incorrect" | null;
  lastSeenAt: string | null;
};

export type Settings = {
  direction: Direction;
};

export type AppState = {
  phrases: Phrase[];
  stats: Record<string, PhraseStats>;
  settings: Settings;
};
