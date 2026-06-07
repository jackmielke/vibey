// Mock tournament data — UI scaffold only.
// Adapted from the World Cup Golden Goal project for the Vibey mini app.

export type MatchStatus = "scheduled" | "live" | "final";

export type Team = {
  code: string;
  name: string;
  flag: string;
  group?: string;
};

export type Match = {
  id: string;
  stage: "Group" | "R16" | "QF" | "SF" | "F";
  group?: string;
  date: string;
  venue: string;
  home: Team;
  away: Team;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
};

export const TEAMS: Record<string, Team> = {
  USA: { code: "USA", name: "United States", flag: "🇺🇸", group: "A" },
  MEX: { code: "MEX", name: "Mexico", flag: "🇲🇽", group: "A" },
  CAN: { code: "CAN", name: "Canada", flag: "🇨🇦", group: "B" },
  ARG: { code: "ARG", name: "Argentina", flag: "🇦🇷", group: "C" },
  BRA: { code: "BRA", name: "Brazil", flag: "🇧🇷", group: "D" },
  FRA: { code: "FRA", name: "France", flag: "🇫🇷", group: "E" },
  ENG: { code: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "F" },
  ESP: { code: "ESP", name: "Spain", flag: "🇪🇸", group: "G" },
  GER: { code: "GER", name: "Germany", flag: "🇩🇪", group: "H" },
  POR: { code: "POR", name: "Portugal", flag: "🇵🇹", group: "C" },
  NED: { code: "NED", name: "Netherlands", flag: "🇳🇱", group: "D" },
  ITA: { code: "ITA", name: "Italy", flag: "🇮🇹", group: "B" },
  BEL: { code: "BEL", name: "Belgium", flag: "🇧🇪", group: "E" },
  CRO: { code: "CRO", name: "Croatia", flag: "🇭🇷", group: "F" },
  URU: { code: "URU", name: "Uruguay", flag: "🇺🇾", group: "G" },
  JPN: { code: "JPN", name: "Japan", flag: "🇯🇵", group: "H" },
};

const t = (k: string) => TEAMS[k];

export const MATCHES: Match[] = [
  { id: "m1", stage: "Group", group: "A", date: "2026-06-11T20:00:00Z", venue: "Estadio Azteca", home: t("MEX"), away: t("USA"), status: "live", homeScore: 1, awayScore: 2, minute: 67 },
  { id: "m2", stage: "Group", group: "C", date: "2026-06-12T19:00:00Z", venue: "MetLife Stadium", home: t("ARG"), away: t("POR"), status: "live", homeScore: 0, awayScore: 0, minute: 23 },
  { id: "m3", stage: "Group", group: "D", date: "2026-06-12T22:00:00Z", venue: "SoFi Stadium", home: t("BRA"), away: t("NED"), status: "scheduled" },
  { id: "m4", stage: "Group", group: "E", date: "2026-06-13T18:00:00Z", venue: "Mercedes-Benz", home: t("FRA"), away: t("BEL"), status: "scheduled" },
  { id: "m5", stage: "Group", group: "F", date: "2026-06-13T21:00:00Z", venue: "Lumen Field", home: t("ENG"), away: t("CRO"), status: "scheduled" },
  { id: "m6", stage: "Group", group: "G", date: "2026-06-14T19:00:00Z", venue: "Levi's Stadium", home: t("ESP"), away: t("URU"), status: "scheduled" },
  { id: "m7", stage: "Group", group: "B", date: "2026-06-10T20:00:00Z", venue: "BMO Field", home: t("CAN"), away: t("ITA"), status: "final", homeScore: 1, awayScore: 3 },
  { id: "m8", stage: "Group", group: "H", date: "2026-06-10T23:00:00Z", venue: "AT&T Stadium", home: t("GER"), away: t("JPN"), status: "final", homeScore: 2, awayScore: 1 },
];

type BracketSlot = { team?: Team; placeholder?: string };
export type BracketMatch = {
  id: string;
  round: "R16" | "QF" | "SF" | "F";
  top: BracketSlot;
  bot: BracketSlot;
  topScore?: number;
  botScore?: number;
  winner?: "top" | "bot";
};

export const R16: BracketMatch[] = [
  { id: "r16-1", round: "R16", top: { team: t("USA") }, bot: { team: t("ITA") }, topScore: 2, botScore: 1, winner: "top" },
  { id: "r16-2", round: "R16", top: { team: t("BRA") }, bot: { team: t("JPN") } },
  { id: "r16-3", round: "R16", top: { team: t("ARG") }, bot: { team: t("CRO") } },
  { id: "r16-4", round: "R16", top: { team: t("FRA") }, bot: { team: t("URU") } },
  { id: "r16-5", round: "R16", top: { team: t("ENG") }, bot: { team: t("MEX") } },
  { id: "r16-6", round: "R16", top: { team: t("ESP") }, bot: { team: t("NED") } },
  { id: "r16-7", round: "R16", top: { team: t("POR") }, bot: { team: t("BEL") } },
  { id: "r16-8", round: "R16", top: { team: t("GER") }, bot: { team: t("CAN") } },
];
export const QF: BracketMatch[] = [
  { id: "qf-1", round: "QF", top: { placeholder: "Winner R16-1" }, bot: { placeholder: "Winner R16-2" } },
  { id: "qf-2", round: "QF", top: { placeholder: "Winner R16-3" }, bot: { placeholder: "Winner R16-4" } },
  { id: "qf-3", round: "QF", top: { placeholder: "Winner R16-5" }, bot: { placeholder: "Winner R16-6" } },
  { id: "qf-4", round: "QF", top: { placeholder: "Winner R16-7" }, bot: { placeholder: "Winner R16-8" } },
];
export const SF: BracketMatch[] = [
  { id: "sf-1", round: "SF", top: { placeholder: "Winner QF-1" }, bot: { placeholder: "Winner QF-2" } },
  { id: "sf-2", round: "SF", top: { placeholder: "Winner QF-3" }, bot: { placeholder: "Winner QF-4" } },
];
export const FINAL: BracketMatch[] = [
  { id: "f-1", round: "F", top: { placeholder: "Winner SF-1" }, bot: { placeholder: "Winner SF-2" } },
];

export type Player = {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  points: number;
  correctPicks: number;
  totalPicks: number;
  trend: number;
  pickToWin: Team;
};

export const PLAYERS: Player[] = [
  { id: "p1", name: "Maya Chen", handle: "@mayakicks", avatar: "🦊", points: 187, correctPicks: 14, totalPicks: 18, trend: 2, pickToWin: t("ARG") },
  { id: "p2", name: "Diego Romero", handle: "@diego10", avatar: "🐉", points: 174, correctPicks: 13, totalPicks: 18, trend: -1, pickToWin: t("BRA") },
  { id: "p3", name: "Sam Patel", handle: "@sampats", avatar: "🦁", points: 162, correctPicks: 12, totalPicks: 18, trend: 1, pickToWin: t("ENG") },
  { id: "p4", name: "Jordan Reyes", handle: "@jrey", avatar: "🐺", points: 148, correctPicks: 11, totalPicks: 18, trend: 0, pickToWin: t("FRA") },
  { id: "p5", name: "Alex Kim", handle: "@axk", avatar: "🦅", points: 132, correctPicks: 10, totalPicks: 18, trend: -2, pickToWin: t("ESP") },
  { id: "p6", name: "Priya Singh", handle: "@priyas", avatar: "🐯", points: 119, correctPicks: 9, totalPicks: 18, trend: 3, pickToWin: t("ARG") },
  { id: "p7", name: "Tom Becker", handle: "@beck", avatar: "🐻", points: 104, correctPicks: 8, totalPicks: 18, trend: -1, pickToWin: t("GER") },
  { id: "p8", name: "Rachel Yu", handle: "@rye", avatar: "🦌", points: 92, correctPicks: 7, totalPicks: 18, trend: 0, pickToWin: t("USA") },
];
