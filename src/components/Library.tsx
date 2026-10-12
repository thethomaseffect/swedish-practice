import { useState, type FormEvent } from "react";
import { createPhrase, findEquivalent, serializeBackup, serializePhrases, updatePhrase } from "../model";
import type { AppState, Phrase } from "../types";
import type { StorageInfo } from "../storage";

type Draft = {
  english: string;
  swedish: string;
  phonetic: string;
  notes: string;
};

type LibraryProps = {
  state: AppState;
  info: StorageInfo;
  onAdd: (phrase: Phrase) => void;
  onUpdate: (phrase: Phrase) => void;
  onDelete: (id: string) => void;
  onImport: (raw: string) => string;
  onChooseFile: () => void;
  onRevealFile: () => void;
  onReload: () => void;
};

const emptyDraft: Draft = { english: "", swedish: "", phonetic: "", notes: "" };

export function Library({ state, info, onAdd, onUpdate, onDelete, onImport, onChooseFile, onRevealFile, onReload }: LibraryProps) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [paste, setPaste] = useState("");

  function addPhrase(event: FormEvent) {
    event.preventDefault();
    if (findEquivalent(state.phrases, draft.english, draft.swedish)) {
      setMessage("That phrase is already in the library.");
      return;
    }
    try {
      onAdd(createPhrase(draft));
      setDraft(emptyDraft);
      setMessage("Added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add that phrase.");
    }
  }

  function saveEdit(event: FormEvent, phrase: Phrase) {
    event.preventDefault();
    const others = state.phrases.filter((item) => item.id !== phrase.id);
    if (findEquivalent(others, editDraft.english, editDraft.swedish)) {
      setMessage("Another phrase already has that English and Swedish.");
      return;
    }
    try {
      onUpdate(updatePhrase(phrase, editDraft));
      setEditingId(null);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save that phrase.");
    }
  }

  function importText(raw: string) {
    try {
      setMessage(onImport(raw));
      setPaste("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import that file.");
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">Library</p>
      <h2>Phrases</h2>
      <p className="lead">
        Each phrase needs English, Swedish, and a pronunciation you can read after you answer. Paste a photo of your
        notes to the agent and it will check the spelling, report anything it changes, and add the phrases here.
      </p>
      {info.mode === "desktop" && info.phrasesPath && (
        <div className="file-box">
          <p className="path">{info.phrasesPath}</p>
          <div className="button-row">
            <button type="button" className="secondary" onClick={onChooseFile}>
              Change file
            </button>
            <button type="button" className="secondary" onClick={onRevealFile}>
              Show file
            </button>
            <button type="button" className="secondary" onClick={onReload}>
              Reload
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      <form className="stack" onSubmit={addPhrase}>
        <PhraseFields draft={draft} onChange={setDraft} />
        <button type="submit" className="primary">
          Add phrase
        </button>
      </form>
      <div className="button-row">
        <button type="button" className="secondary" onClick={() => downloadJson("phrases.json", serializePhrases(state.phrases))}>
          Export phrases
        </button>
        <button type="button" className="secondary" onClick={() => downloadJson("swedish-practice-backup.json", serializeBackup(state))}>
          Export backup
        </button>
        <label className="secondary file-button">
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void file.text().then(importText);
            }}
          />
        </label>
      </div>
      <details className="paste-box">
        <summary>Paste JSON</summary>
        <textarea
          rows={8}
          value={paste}
          onChange={(event) => setPaste(event.target.value)}
          placeholder='{"version":1,"phrases":[{"id":"en-kaffe","english":"a coffee","swedish":"en kaffe","phonetic":"ehn KAF-feh","notes":"","createdAt":"2026-10-12T00:00:00.000Z","updatedAt":"2026-10-12T00:00:00.000Z"}]}'
        />
        <button type="button" className="secondary" onClick={() => importText(paste)} disabled={paste.trim().length === 0}>
          Import pasted JSON
        </button>
      </details>
      <ul className="phrase-list">
        {state.phrases.map((phrase) => (
          <li key={phrase.id} className="phrase-card">
            {editingId === phrase.id ? (
              <form className="stack" onSubmit={(event) => saveEdit(event, phrase)}>
                <PhraseFields draft={editDraft} onChange={setEditDraft} />
                <div className="button-row">
                  <button type="submit" className="primary">
                    Save
                  </button>
                  <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="swedish" lang="sv">
                  {phrase.swedish}
                </p>
                <p className="phonetic">{phrase.phonetic}</p>
                <p className="english">{phrase.english}</p>
                {phrase.notes && <p className="muted">{phrase.notes}</p>}
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setEditingId(phrase.id);
                      setEditDraft({
                        english: phrase.english,
                        swedish: phrase.swedish,
                        phonetic: phrase.phonetic,
                        notes: phrase.notes,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => {
                      if (window.confirm(`Remove “${phrase.swedish}”?`)) onDelete(phrase.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PhraseFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <div className="form-grid">
      <label className="field">
        English
        <textarea rows={2} value={draft.english} onChange={(event) => onChange({ ...draft, english: event.target.value })} required />
      </label>
      <label className="field">
        Swedish
        <textarea rows={2} value={draft.swedish} onChange={(event) => onChange({ ...draft, swedish: event.target.value })} required lang="sv" />
      </label>
      <label className="field wide">
        Pronunciation
        <textarea
          rows={2}
          value={draft.phonetic}
          onChange={(event) => onChange({ ...draft, phonetic: event.target.value })}
          placeholder="yahg SKOOL-leh VIL-ya hah KAF-feh"
          required
        />
      </label>
      <label className="field wide">
        Notes
        <textarea rows={2} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
      </label>
    </div>
  );
}

function downloadJson(filename: string, contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
