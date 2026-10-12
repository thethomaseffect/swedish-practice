export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakPhonetic(phonetic: string): void {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(phonetic.toLocaleLowerCase("en").replace(/-/g, " "));
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
