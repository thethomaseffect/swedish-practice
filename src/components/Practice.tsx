import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { answersMatch, cardDirection, pickSession, SESSION_SIZE } from "../model";
import { canSpeak, speakPhonetic } from "../speak";
import type { Direction, Phrase, PhraseStats, PromptDirection } from "../types";

type Card = {
  phraseId: string;
  direction: PromptDirection;
  outcome: "correct" | "incorrect" | null;
  given: string;
};

type Session = {
  cards: Card[];
  index: number;
  phase: "answer" | "feedback" | "done";
};

type PracticeProps = {
  phrases: Phrase[];
  stats: Record<string, PhraseStats>;
  direction: Direction;
  onDirection: (direction: Direction) => void;
  onResult: (phraseId: string, correct: boolean) => void;
  onOpenLibrary: () => void;
};

export function Practice({ phrases, stats, direction, onDirection, onResult, onOpenLibrary }: PracticeProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [draft, setDraft] = useState("");
  const acceptingAnswer = useRef(true);
  const phrasesById = useMemo(() => new Map(phrases.map((phrase) => [phrase.id, phrase])), [phrases]);
  const sessionLength = Math.min(SESSION_SIZE, phrases.length);

  useEffect(() => {
    if (phrases.length === 0) setSession(null);
  }, [phrases.length]);

  function start() {
    const picked = pickSession(phrases, stats);
    acceptingAnswer.current = true;
    setDraft("");
    setSession({
      index: 0,
      phase: "answer",
      cards: picked.map((phrase) => ({
        phraseId: phrase.id,
        direction: cardDirection(direction),
        outcome: null,
        given: "",
      })),
    });
  }

  function stop() {
    if (!session) return;
    const answered = session.cards.filter((card) => card.outcome);
    if (answered.length === 0) {
      setSession(null);
      return;
    }
    setSession({ cards: answered, index: answered.length - 1, phase: "done" });
  }

  if (phrases.length === 0) {
    return (
      <section className="panel">
        <p className="eyebrow">Practice</p>
        <h2>Nothing to revise yet</h2>
        <p className="lead">
          Add a phrase in the library, or paste a photo of your notes to the agent. It will check the spelling and
          translation, then file the phrases for the next session.
        </p>
        <button type="button" className="primary" onClick={onOpenLibrary}>
          Add phrases
        </button>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="panel">
        <p className="eyebrow">Practice</p>
        <h2>A short session</h2>
        <p className="lead">
          {sessionLength === 1 ? "1 phrase" : `${sessionLength} phrases`}, leaning toward the ones that have been going
          badly. After each answer you get the pronunciation, then you move on yourself.
        </p>
        <fieldset className="choice-row">
          <legend>Ask me for</legend>
          <label>
            <input
              type="radio"
              name="direction"
              checked={direction === "en-sv"}
              onChange={() => onDirection("en-sv")}
            />
            Swedish
          </label>
          <label>
            <input
              type="radio"
              name="direction"
              checked={direction === "sv-en"}
              onChange={() => onDirection("sv-en")}
            />
            English
          </label>
          <label>
            <input type="radio" name="direction" checked={direction === "mix"} onChange={() => onDirection("mix")} />
            Either
          </label>
        </fieldset>
        <button type="button" className="primary" onClick={start}>
          Start session
        </button>
      </section>
    );
  }

  if (session.phase === "done") {
    const correct = session.cards.filter((card) => card.outcome === "correct").length;
    const misses = session.cards.filter((card) => card.outcome === "incorrect");
    return (
      <section className="panel">
        <p className="eyebrow">Session</p>
        <h2>
          {correct} of {session.cards.length}
        </h2>
        <p className="lead">{misses.length === 0 ? "All of them landed." : "These are the ones to say again."}</p>
        {misses.length > 0 && (
          <ul className="miss-list">
            {misses.map((card) => {
              const phrase = phrasesById.get(card.phraseId);
              if (!phrase) return null;
              return (
                <li key={card.phraseId}>
                  <span className="swedish" lang="sv">
                    {phrase.swedish}
                  </span>
                  <span className="phonetic">{phrase.phonetic}</span>
                  <span className="english">{phrase.english}</span>
                </li>
              );
            })}
          </ul>
        )}
        <button type="button" className="primary" onClick={() => setSession(null)}>
          Another session
        </button>
      </section>
    );
  }

  const card = session.cards[session.index];
  const phrase = phrasesById.get(card.phraseId);
  const promptIsEnglish = card.direction === "en-sv";
  const expected = phrase ? (promptIsEnglish ? phrase.swedish : phrase.english) : "";
  const prompt = phrase ? (promptIsEnglish ? phrase.english : phrase.swedish) : "";

  function checkAnswer(event: FormEvent) {
    event.preventDefault();
    if (!acceptingAnswer.current || !phrase || session?.phase !== "answer") return;
    const given = draft.trim();
    if (!given) return;
    acceptingAnswer.current = false;
    const correct = answersMatch(expected, given);
    const outcome: Card["outcome"] = correct ? "correct" : "incorrect";
    onResult(phrase.id, correct);
    setSession((current) => {
      if (!current) return current;
      const cards = current.cards.map((item, index) => (index === current.index ? { ...item, outcome, given } : item));
      return { ...current, cards, phase: "feedback" as const };
    });
  }

  function next() {
    acceptingAnswer.current = true;
    setDraft("");
    setSession((current) => {
      if (!current) return current;
      if (current.index >= current.cards.length - 1) return { ...current, phase: "done" };
      return { ...current, index: current.index + 1, phase: "answer" };
    });
  }

  return (
    <section className="panel">
      <div className="session-top">
        <p className="progress">
          Phrase {session.index + 1} of {session.cards.length}
        </p>
        <button type="button" className="quiet" onClick={stop}>
          Stop
        </button>
      </div>
      {!phrase ? (
        <div>
          <h2>That phrase was removed</h2>
          <button type="button" className="primary" onClick={next}>
            Next
          </button>
        </div>
      ) : (
        <>
          <p className="eyebrow">{promptIsEnglish ? "English" : "Swedish"}</p>
          <h2 className="prompt-text" lang={promptIsEnglish ? "en" : "sv"}>
            {prompt}
          </h2>
          {session.phase === "answer" ? (
            <form onSubmit={checkAnswer}>
              <label className="field" htmlFor="answer">
                {promptIsEnglish ? "Swedish" : "English"}
              </label>
              <div className="answer-row">
                <input
                  id="answer"
                  className="answer-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  lang={promptIsEnglish ? "sv" : "en"}
                  placeholder={promptIsEnglish ? "Type the Swedish" : "Type the English"}
                />
                <button type="submit" className="primary" disabled={draft.trim().length === 0}>
                  Check
                </button>
              </div>
            </form>
          ) : (
            <div className={card.outcome === "correct" ? "feedback correct" : "feedback incorrect"} aria-live="polite">
              <p className="verdict">{card.outcome === "correct" ? "That's it" : "Not quite"}</p>
              {card.outcome === "incorrect" && (
                <p>
                  <span className="muted">You wrote </span>
                  {card.given}
                </p>
              )}
              <p className="swedish" lang="sv">
                {phrase.swedish}
              </p>
              <div className="say-block">
                <p className="eyebrow">Say it</p>
                <p className="phonetic">{phrase.phonetic}</p>
                {canSpeak() && (
                  <button type="button" className="secondary" onClick={() => speakPhonetic(phrase.phonetic)}>
                    Listen
                  </button>
                )}
              </div>
              <p className="english">{phrase.english}</p>
              <button type="button" className="primary" onClick={next}>
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
