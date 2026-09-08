export type PlayerRole =
  | "Batter"
  | "Bowler"
  | "All-Rounder"
  | "Wicketkeeper";

export interface Player {
  id: number;
  name: string;
  role: PlayerRole;
  basePrice: number;
  purchasePrice: number;
  photo?: string;
}

export interface AuctionPlayer {
  id: number;
  name: string;
  role: PlayerRole;
  basePrice: number;
  photo?: string;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  owner: string;
  startingPurse: number;
  players: Player[];
  logo?: string;
}

export interface TournamentSettings {
  tournamentName: string;
  seasonName: string;
  squadLimit: number;
}

export type AuctionTimerStatus =
  | "STOPPED"
  | "RUNNING"
  | "PAUSED";

export type AuctionCallState =
  | "BIDDING"
  | "GOING_ONCE"
  | "GOING_TWICE"
  | "FINAL_CALL";
