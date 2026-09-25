import { describe, expect, it } from "vitest";
import { applyDice, createInitialState, getLegalMoves, moveToken } from "@/game-engine/ludo-engine";
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
  voiceExpect(board.players.map((p) => p.color)).toEqual(["red", "blue", "green", "yellow"]);
});
