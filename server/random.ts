import { randomInt } from "node:crypto";

export function secureServerDice(): number {
  return randomInt(1, 7);
}
