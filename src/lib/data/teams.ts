import type { Team } from "@/types";
import { getAllTeams, getTeamStats } from "@/data/service";

/** Transparent model priors for known elite clubs (strength constants). Unknown clubs get league-median priors. */
const PRIORS: Record<string, { att: number; def: number; rating: number; venue: string }> = {
  "Manchester City": { att: 2.3, def: 1.0, rating: 92, venue: "Etihad Stadium" },
  Arsenal: { att: 2.1, def: 1.1, rating: 89, venue: "Emirates Stadium" },
  Liverpool: { att: 2.2, def: 1.2, rating: 89, venue: "Anfield" },
  Chelsea: { att: 1.9, def: 1.2, rating: 84, venue: "Stamford Bridge" },
  "Manchester United": { att: 1.8, def: 1.4, rating: 82, venue: "Old Trafford" },
  Tottenham: { att: 1.9, def: 1.4, rating: 82, venue: "Tottenham Hotspur Stadium" },
  Newcastle: { att: 1.8, def: 1.3, rating: 83, venue: "St James' Park" },
  "Aston Villa": { att: 1.7, def: 1.4, rating: 81, venue: "Villa Park" },
  Brighton: { att: 1.6, def: 1.4, rating: 80, venue: "Amex Stadium" },
  "West Ham": { att: 1.4, def: 1.5, rating: 76, venue: "London Stadium" },
  "Real Madrid": { att: 2.4, def: 0.9, rating: 94, venue: "Santiago Bernabeu" },
  Barcelona: { att: 2.2, def: 1.1, rating: 90, venue: "Estadi Olimpic Lluis Companys" },
  "Atletico Madrid": { att: 1.9, def: 1.0, rating: 86, venue: "Metropolitano" },
  "Athletic Club": { att: 1.7, def: 1.1, rating: 83, venue: "San Mames" },
  Villarreal: { att: 1.6, def: 1.4, rating: 79, venue: "Estadio de la Ceramica" },
  "Real Sociedad": { att: 1.5, def: 1.2, rating: 79, venue: "Reale Arena" },
  "Real Betis": { att: 1.4, def: 1.3, rating: 77, venue: "Benito Villamarin" },
  Valencia: { att: 1.3, def: 1.3, rating: 76, venue: "Mestalla" },
  Sevilla: { att: 1.3, def: 1.4, rating: 75, venue: "Ramon Sanchez-Pizjuan" },
  Inter: { att: 2.1, def: 0.8, rating: 91, venue: "San Siro" },
  "AC Milan": { att: 1.8, def: 1.1, rating: 84, venue: "San Siro" },
  Juventus: { att: 1.6, def: 1.0, rating: 84, venue: "Allianz Stadium" },
  Napoli: { att: 1.8, def: 1.2, rating: 83, venue: "Diego Armando Maradona" },
  Atalanta: { att: 1.9, def: 1.2, rating: 84, venue: "Gewiss Stadium" },
  Roma: { att: 1.6, def: 1.3, rating: 80, venue: "Stadio Olimpico" },
  Lazio: { att: 1.5, def: 1.2, rating: 79, venue: "Stadio Olimpico" },
  Bologna: { att: 1.5, def: 1.1, rating: 80, venue: "Renato Dall'Ara" },
  Fiorentina: { att: 1.5, def: 1.3, rating: 78, venue: "Artemio Franchi" },
  "Bayern Munich": { att: 2.6, def: 1.1, rating: 93, venue: "Allianz Arena" },
  "Bayer Leverkusen": { att: 2.2, def: 1.1, rating: 90, venue: "BayArena" },
  "Borussia Dortmund": { att: 2.0, def: 1.3, rating: 85, venue: "Signal Iduna Park" },
  "RB Leipzig": { att: 1.9, def: 1.2, rating: 84, venue: "Red Bull Arena" },
  Stuttgart: { att: 2.0, def: 1.3, rating: 84, venue: "MHPArena" },
  "Eintracht Frankfurt": { att: 1.7, def: 1.4, rating: 79, venue: "Deutsche Bank Park" },
  "Paris Saint-Germain": { att: 2.4, def: 0.9, rating: 93, venue: "Parc des Princes" },
  Monaco: { att: 1.9, def: 1.2, rating: 84, venue: "Stade Louis II" },
  Marseille: { att: 1.7, def: 1.2, rating: 82, venue: "Orange Velodrome" },
  Lille: { att: 1.6, def: 1.1, rating: 81, venue: "Stade Pierre-Mauroy" },
  Lyon: { att: 1.6, def: 1.3, rating: 79, venue: "Groupama Stadium" },
  Nice: { att: 1.5, def: 1.0, rating: 81, venue: "Allianz Riviera" },
  Lens: { att: 1.5, def: 1.1, rating: 79, venue: "Stade Bollaert-Delelis" }
};

const DEFAULT_PRIOR = { att: 1.6, def: 1.4, rating: 76, venue: "TBA" };

function priorKey(name: string): string {
  const cleaned = name
    .replace(/\b(FC|CF|SAD|SC|CD|AC|BV|AS|RC|SD|UD|SS|US|LOSC)\b/gi, "")
    .replace(/^Inter Milan$/i, "Inter")
    .replace(/\s+/g, " ")
    .trim();
  return PRIORS[cleaned] ? cleaned : name;
}

function build(): Team[] {
  return getAllTeams().map((t) => {
    const prior = PRIORS[priorKey(t.name)] ?? DEFAULT_PRIOR;
    const stats = getTeamStats(t.id);
    const form: Team["form"] = (stats?.results ?? [])
      .slice(-5)
      .map((r) => ({ result: r.result, gf: r.for, ga: r.against }));
    return {
      id: t.id,
      name: t.name,
      short: t.short,
      leagueSlug: t.leagueId,
      att: prior.att,
      def: prior.def,
      rating: prior.rating,
      colors: t.colors,
      venue: prior.venue,
      form
    };
  });
}

export const TEAMS: Team[] = build();

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}

export function getTeamsByLeague(leagueId: string): Team[] {
  return TEAMS.filter((t) => t.leagueSlug === leagueId).sort((a, b) => b.rating - a.rating);
}

export function teamSlug(team: Team): string {
  return team.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTeamBySlug(slug: string): Team | undefined {
  return TEAMS.find((t) => teamSlug(t) === slug);
}

export function getTeamLeague(team: Team): Team {
  return getTeamsByLeague(team.leagueSlug).find((t) => t.id === team.id) ?? team;
}

export function getAllTeamSlugs(): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const team of TEAMS) {
    const slug = teamSlug(team);
    if (!seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }
  return slugs;
}