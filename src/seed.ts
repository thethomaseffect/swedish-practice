import seedFile from "../data/phrases.json";
import { parsePhrasesJson } from "./model";
import type { Phrase } from "./types";

const parsed = parsePhrasesJson(JSON.stringify(seedFile));

export function seedPhrases(): Phrase[] {
  return parsed.map((phrase) => ({ ...phrase }));
}
