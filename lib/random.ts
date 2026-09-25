export function secureLocalDice(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] % 6) + 1;
}

export function createActionId(): string {
  return crypto.randomUUID();
}
