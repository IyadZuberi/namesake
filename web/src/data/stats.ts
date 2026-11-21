import board from "../../data/scoreboard.json";

export const scoreboard = board as typeof board & { unit_tests: number };
