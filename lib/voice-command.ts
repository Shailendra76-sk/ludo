import type { GameState } from "@/lib/types";

export type VoiceIntent =
  | { type: "roll"; spokenValue?: number }
  | { type: "move"; tokenId: number };

const DIGITS: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  "छह": 6, "छ:": 6, "छः": 6, "छे": 6, "छः": 6,
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पांच": 5,
};
const TOKEN_WORDS = ["token", "goti", "gotि", "गोटी", "गोटि", "piece", "pawn", "move", "चलाओ", "चलो", "चल", "move"];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numbersIn(text: string): number[] {
  return text.split(" ").flatMap((word) => DIGITS[word] === undefined ? [] : [DIGITS[word]]);
}

export function parseVoiceCommand(input: string, state: GameState): VoiceIntent | null {
  const text = normalize(input);
  if (!text) return null;

  const numbers = numbersIn(text);
  const hasRollWord = /\b(roll|dice|throw|फेंक|पासा|पासे|डाइस|घुमाओ|roll\s*dice)\b/u.test(text);
  const mentionsMove = TOKEN_WORDS.some((word) => text.includes(word));

  if (state.dice !== null) {
    const tokenNumber = numbers.find((n) => n >= 1 && n <= 4);
    if (mentionsMove || tokenNumber !== undefined) {
      return tokenNumber !== undefined ? { type: "move", tokenId: tokenNumber - 1 } : null;
    }
  }

  if (hasRollWord || (state.dice === null && numbers.some((n) => n >= 1 && n <= 6) && !mentionsMove)) {
    const spokenValue = numbers.find((n) => n >= 1 && n <= 6);
    return { type: "roll", spokenValue };
  }

  return null;
}

export function explainVoiceIntent(intent: VoiceIntent): string {
  if (intent.type === "roll") {
    return intent.spokenValue ? "Roll command understood." : "Roll dice command understood.";
  }
  return "Move token " + (intent.tokenId + 1) + " command understood.";
}
