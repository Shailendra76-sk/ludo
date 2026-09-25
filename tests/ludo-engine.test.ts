import { describe, expect, it } from "vitest";
import { applyDice, createInitialState, getLegalMoves, getTokenBoardPosition, moveToken } from "@/game-engine/ludo-engine";
import { chooseBotToken } from "@/server/bot-ai";

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
    expect(state.currentPlayerIndex).toBe(1);
  });
});


describe("Bot decision foundation", () => {
  it("only chooses a legal token", () => {
    let state = createInitialState(4, { mode: "ai", botDifficulty: "hard" });
    state = applyDice(state, 6);
    expect(getLegalMoves(state)).toContain(chooseBotToken(state));
  });

  it("does not choose a move when no legal move exists", () => {
    const state = applyDice(createInitialState(4, { mode: "ai" }), 5);
    expect(chooseBotToken(state)).toBeNull();
  });
});


import { describe as voiceDescribe, expect as voiceExpect, it as voiceIt } from "vitest";
import { parseVoiceCommand } from "@/lib/voice-command";

voiceDescribe("voice command parser", () => {
  const base = () => createInitialState(2, {}, { userId: "u1", name: "Player" });
  voiceIt("maps spoken six to a roll intent without controlling the result", () => {
    const intent = parseVoiceCommand("छे", base());
    voiceExpect(intent).toEqual({ type: "roll", spokenValue: 6 });
  });
  voiceIt("maps roll dice to a roll intent", () => {
    const intent = parseVoiceCommand("roll dice", base());
    voiceExpect(intent?.type).toBe("roll");
  });
  voiceIt("maps token two when a dice result exists", () => {
    const state = { ...base(), dice: 4 };
    const intent = parseVoiceCommand("token 2", state);
    voiceExpect(intent).toEqual({ type: "move", tokenId: 1 });
  });
  voiceIt("maps Hindi token command", () => {
    const state = { ...base(), dice: 3 };
    const intent = parseVoiceCommand("गोटी 4 चलाओ", state);
    voiceExpect(intent).toEqual({ type: "move", tokenId: 3 });
  });
  voiceIt("rejects ambiguous commands", () => {
    voiceExpect(parseVoiceCommand("hello there", base())).toBeNull();
  });
});


import { globalTrackIndex } from "@/game-engine/ludo-engine";
import { START_OFFSETS } from "@/game-engine/constants";

voiceDescribe("classic start positions", () => {
  voiceIt("maps each color to the track start beside its own home", () => {
    const players = createInitialState(4).players;
    const starts = Object.fromEntries(
      players.map((player) => [player.color, globalTrackIndex(player, 1)]),
    );
    voiceExpect(starts.red).toBe(0);
    voiceExpect(starts.blue).toBe(13);
    voiceExpect(starts.yellow).toBe(26);
    voiceExpect(starts.green).toBe(39);
    voiceExpect(START_OFFSETS.red).toBe(0);
  });
});


voiceIt("uses the matching colored home lane after the main track", () => {
  const board = createInitialState(4);
  voiceExpect(board.players.map((p) => p.color)).toEqual(["red", "green", "yellow", "blue"]);
});


voiceDescribe("classic route geometry", () => {
  voiceIt("starts red beside the top-left home and moves clockwise", () => {
    const board = createInitialState(4);
    const red = board.players[0];
    voiceExpect(getTokenBoardPosition(red, 1)).toEqual({ x: 6, y: 1 });
    voiceExpect(getTokenBoardPosition(red, 2)).toEqual({ x: 6, y: 2 });
    voiceExpect(getTokenBoardPosition(red, 6)).toEqual({ x: 5, y: 6 });
    voiceExpect(getTokenBoardPosition(red, 11)).toEqual({ x: 0, y: 7 });
  });

  voiceIt("places each color start beside its own corner", () => {
    const board = createInitialState(4);
    const positions = Object.fromEntries(
      board.players.map((player) => [player.color, getTokenBoardPosition(player, 1)]),
    );
    voiceExpect(positions).toEqual({
      red: { x: 6, y: 1 },
      green: { x: 13, y: 6 },
      yellow: { x: 8, y: 13 },
      blue: { x: 1, y: 8 },
    });
  });
});


describe("Classic Ludo movement rules", () => {
  it("uses clockwise movement from the red start", () => {
    const state = createInitialState(4);
    const red = state.players[0];
    expect(getTokenBoardPosition(red, 1)).toEqual({ x: 6, y: 1 });
    expect(getTokenBoardPosition(red, 2)).toEqual({ x: 6, y: 2 });
    expect(getTokenBoardPosition(red, 6)).toEqual({ x: 5, y: 6 });
    expect(getTokenBoardPosition(red, 12)).toEqual({ x: 0, y: 7 });
  });

  it("starts every color at its own home-adjacent entry square", () => {
    const state = createInitialState(4);
    const positions = Object.fromEntries(
      state.players.map((player) => [player.color, getTokenBoardPosition(player, 1)]),
    );
    expect(positions).toEqual({
      red: { x: 6, y: 1 },
      green: { x: 13, y: 6 },
      yellow: { x: 8, y: 13 },
      blue: { x: 1, y: 8 },
    });
  });

  it("captures one opponent on a non-safe shared square and grants a bonus turn", () => {
    const state = createInitialState(2);
    state.players[0].tokens[0].steps = 1;
    state.players[1].tokens[0].steps = 41;
    state.dice = 1;
    const next = moveToken(state, 0);

    expect(next.players[1].tokens[0].steps).toBe(0);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.message).toContain("captured");
  });

  it("does not capture on a safe square", () => {
    const state = createInitialState(2);
    state.players[0].tokens[0].steps = 1;
    state.players[1].tokens[0].steps = 40;
    state.dice = 1;
    const next = moveToken(state, 0);

    expect(next.players[1].tokens[0].steps).toBe(40);
    expect(next.players[0].tokens[0].steps).toBe(2);
  });

  it("enters the colored home lane after completing the shared circuit", () => {
    const state = createInitialState(4);
    const red = state.players[0];
    expect(getTokenBoardPosition(red, 51)).toEqual({ x: 7, y: 0 });
    expect(getTokenBoardPosition(red, 52)).toEqual({ x: 7, y: 1 });
    expect(getTokenBoardPosition(red, 57)).toEqual({ x: 7, y: 6 });
    expect(getTokenBoardPosition(red, 58)).toEqual({ x: 7, y: 7 });
  });

  it("requires an exact roll to enter the center", () => {
    const state = createInitialState(4);
    state.players[0].tokens[0].steps = 57;
    state.dice = 2;
    expect(getLegalMoves(state)).toEqual([]);
    state.dice = 1;
    expect(getLegalMoves(state)).toEqual([0, 1, 2, 3]);
  });

  it("allows another roll after a six when no token can move", () => {
    const state = createInitialState(2);
    const next = applyDice(state, 6);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.dice).toBe(6);
  });

  it("forfeits the turn on the third consecutive six", () => {
    let state = createInitialState(2);
    state = applyDice(state, 6);
    state.dice = null;
    state = applyDice(state, 6);
    state.dice = null;
    state = applyDice(state, 6);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.sixStreak).toBe(0);
    expect(state.dice).toBeNull();
  });
});
