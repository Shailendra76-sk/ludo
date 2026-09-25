import { describe, expect, it } from "vitest";
import { applyDice, createInitialState, getLegalMoves, moveToken } from "@/game-engine/ludo-engine";

describe("Ludo engine foundation", () => {
  it("creates the requested player count with four tokens each", () => {
    const state = createInitialState(3);
    expect(state.players).toHaveLength(3);
    expect(state.players.every((player) => player.tokens.length === 4)).toBe(true);
  });

  it("requires six to leave base by default", () => {
    const state = applyDice(createInitialState(4), 5);
    expect(getLegalMoves(state)).toEqual([]);
  });

  it("allows a token to leave base on six", () => {
    let state = applyDice(createInitialState(4), 6);
    expect(getLegalMoves(state)).toEqual([0, 1, 2, 3]);
    state = moveToken(state, 0);
    expect(state.players[0].tokens[0].steps).toBe(1);
  });

  it("rejects invalid token identifiers", () => {
    const state = applyDice(createInitialState(4), 6);
    const next = moveToken(state, 99);
    expect(next.players[0].tokens.every((token) => token.steps === 0)).toBe(true);
  });

  it("moves to the next player after a non-six move", () => {
    let state = createInitialState(4);
    state = applyDice(state, 6);
    state = moveToken(state, 0);
    state = applyDice(state, 3);
    state = moveToken(state, 0);
    expect(state.currentPlayerIndex).toBe(2);
  });
});
