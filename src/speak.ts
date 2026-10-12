export function canSpeakSwedish(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakSwedish(text: string): void {
  if (!canSpeakSwedish()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "sv-SE";
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
