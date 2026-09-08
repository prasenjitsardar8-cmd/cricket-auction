import type {
  Team,
  TournamentSettings,
} from "./types";

export const initialTournamentSettings: TournamentSettings = {
  tournamentName: "CRICKET AUCTION ARENA",
  seasonName: "Season 2026",
  squadLimit: 18,
};

export const teams: Team[] = [
  {
    id: 1,
    name: "Phoenix XI",
    shortName: "PXI",
    owner: "Owner 1",
    startingPurse: 100,
    players: [],
  },

  {
    id: 2,
    name: "Royal Titans",
    shortName: "RT",
    owner: "Owner 2",
    startingPurse: 100,
    players: [],
  },

  {
    id: 3,
    name: "Warrior Kings",
    shortName: "WK",
    owner: "Owner 3",
    startingPurse: 100,
    players: [],
  },

  {
    id: 4,
    name: "Thunder Strikers",
    shortName: "TS",
    owner: "Owner 4",
    startingPurse: 100,
    players: [],
  },

  {
    id: 5,
    name: "Knight Riders",
    shortName: "KR",
    owner: "Owner 5",
    startingPurse: 100,
    players: [],
  },

  {
    id: 6,
    name: "Super Challengers",
    shortName: "SC",
    owner: "Owner 6",
    startingPurse: 100,
    players: [],
  },
];
