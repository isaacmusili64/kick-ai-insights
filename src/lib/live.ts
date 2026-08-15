/** Live match state shared between server feed and UI. */

export type MatchState = "scheduled" | "soon" | "live" | "finished" | "postponed";

export type LiveScore = {
  state: MatchState;
  /** Provider clock/period text, e.g. "62'" or "HT". */
  detail: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "LIVE", "SUSPENDED"]);
const DONE_STATUSES = new Set(["FINISHED", "AWARDED"]);
const OFF_STATUSES = new Set(["POSTPONED", "CANCELLED", "CANCELED", "SUSPENDED"]);

/** Best-effort state from the fixture feed alone (no live provider needed). */
export function stateFromFixture(status: string, utcDate: string, now = Date.now()): MatchState {
  if (DONE_STATUSES.has(status)) return "finished";
  if (LIVE_STATUSES.has(status)) return "live";
  if (OFF_STATUSES.has(status)) return "postponed";
  const kick = new Date(utcDate).getTime();
  if (Number.isFinite(kick)) {
    if (now >= kick + 150 * 60_000) return "finished";
    if (now >= kick) return "live";
    if (kick - now <= 60 * 60_000) return "soon";
  }
  return "scheduled";
}

export function stateLabel(state: MatchState, detail: string | null, utcDate: string): string {
  switch (state) {
    case "live":
      return detail ? `Live ${detail}` : "Live";
    case "soon":
      return "Starting soon";
    case "finished":
      return detail ?? "Finished";
    case "postponed":
      return "Postponed";
    default:
      return new Date(utcDate).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
}

export function isDecided(state: MatchState) {
  return state === "live" || state === "finished";
}