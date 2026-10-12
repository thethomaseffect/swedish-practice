import { useMemo, useState } from "react";
import { accuracyLabel, troubleLabel, troubleWeight } from "../model";
import type { Phrase, PhraseStats } from "../types";

type Sort = "trouble" | "swedish" | "english" | "newest";

type ReviewProps = {
  phrases: Phrase[];
  stats: Record<string, PhraseStats>;
};

export function Review({ phrases, stats }: ReviewProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("trouble");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("sv-SE");
    const filtered = phrases.filter((phrase) => {
      if (!needle) return true;
      return `${phrase.english} ${phrase.swedish} ${phrase.phonetic} ${phrase.notes}`
        .toLocaleLowerCase("sv-SE")
        .includes(needle);
    });
    return filtered.sort((left, right) => {
      if (sort === "swedish") return left.swedish.localeCompare(right.swedish, "sv");
      if (sort === "english") return left.english.localeCompare(right.english, "en");
      if (sort === "newest") return right.createdAt.localeCompare(left.createdAt);
      return troubleWeight(stats[right.id]) - troubleWeight(stats[left.id]) || left.swedish.localeCompare(right.swedish, "sv");
    });
  }, [phrases, query, sort, stats]);

  return (
    <section className="panel">
      <p className="eyebrow">Review</p>
      <h2>All the phrases</h2>
      <p className="lead">Swedish, the pronunciation, and how each one has been going. Read them aloud from here.</p>
      <div className="toolbar">
        <label className="field grow">
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Swedish, English, or pronunciation" />
        </label>
        <label className="field">
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            <option value="trouble">Needs work</option>
            <option value="swedish">Swedish</option>
            <option value="english">English</option>
            <option value="newest">Newest</option>
          </select>
        </label>
      </div>
      {phrases.length === 0 ? (
        <p>No phrases yet.</p>
      ) : visible.length === 0 ? (
        <p>Nothing matches that search.</p>
      ) : (
        <ul className="phrase-list">
          {visible.map((phrase) => {
            const label = troubleLabel(stats[phrase.id]);
            return (
              <li key={phrase.id} className="phrase-card">
                <div className="phrase-head">
                  <span className={badgeClass(label)}>{label}</span>
                  <span className="muted">{accuracyLabel(stats[phrase.id])}</span>
                </div>
                <p className="swedish" lang="sv">
                  {phrase.swedish}
                </p>
                <p className="phonetic">{phrase.phonetic}</p>
                <p className="english">{phrase.english}</p>
                {phrase.notes && <p className="muted">{phrase.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function badgeClass(label: ReturnType<typeof troubleLabel>): string {
  if (label === "Needs work") return "badge badge-trouble";
  if (label === "Shaky") return "badge badge-shaky";
  if (label === "Steady") return "badge badge-steady";
  return "badge";
}
