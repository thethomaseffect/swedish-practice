import { describe, expect, it } from "vitest";
import { answersMatch } from "./model";
import { seedPhrases } from "./seed";

describe("tourist seed", () => {
  it("includes everyday tourist phrases with pronunciations", () => {
    const phrases = seedPhrases();
    const howAreYou = phrases.find((phrase) => phrase.id === "hur-mar-du");
    const english = phrases.find((phrase) => phrase.id === "pratar-du-engelska");
    expect(howAreYou?.swedish).toBe("Hur mår du?");
    expect(howAreYou?.phonetic).toBe("huer mawr doo");
    expect(english?.english).toBe("Do you speak English?");
    expect(answersMatch(english?.swedish ?? "", "talar du engelska")).toBe(true);
    expect(phrases.length).toBeGreaterThan(30);
    expect(new Set(phrases.map((phrase) => phrase.id)).size).toBe(phrases.length);
  });
});
