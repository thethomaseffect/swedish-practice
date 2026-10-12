/// <reference types="vite/client" />

type DesktopSnapshot = {
  phrasesPath: string;
  statsPath: string;
  phrasesJson: string | null;
  statsJson: string | null;
  canceled?: boolean;
};

type DesktopWrite = {
  phrasesJson: string | null;
  statsJson: string;
};

interface SwedishPracticeApi {
  read: () => Promise<DesktopSnapshot>;
  write: (payload: DesktopWrite) => Promise<DesktopSnapshot>;
  choose: () => Promise<DesktopSnapshot>;
  reveal: () => Promise<void>;
  subscribe: (callback: () => void) => void;
  unsubscribe: () => void;
}

interface Window {
  swedishPractice?: SwedishPracticeApi;
}
