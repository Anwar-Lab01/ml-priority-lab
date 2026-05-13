import {
  MAP_EXPLORER_ROAD_ALIASES,
  MAP_EXPLORER_ROAD_REF_ALIASES,
  type MapExplorerAliasMethod,
} from '../data/mapExplorerRoadAliases';
import type { RankingRow } from '../types/contracts';
import { getRoadKey, normalizeRoadIdentity } from './utils';

export type MapExplorerMatchMethod =
  | 'direct'
  | 'alias'
  | 'manual_alias'
  | 'manual_ref_alias'
  | 'matched_name'
  | 'unmatched'
  | 'ambiguous';

export interface MapExplorerDiagnosticsRow {
  mapRoadName: string;
  normalizedMapKey: string;
  aliasKey: string | null;
  matchedName: string | null;
  matchedNameKey: string | null;
  matchedRankingName: string | null;
  matchedRankingKey: string | null;
  matchMethod: MapExplorerMatchMethod;
  ambiguousRankingNames: string[];
}

export interface MapExplorerMatchResult {
  rankingRow: RankingRow | null;
  matchMethod: MapExplorerMatchMethod;
  diagnostics: MapExplorerDiagnosticsRow;
}

interface CandidateResolution {
  key: string;
  rankingRow: RankingRow | null;
  ambiguousRows: RankingRow[];
}

function preprocessMapExplorerRoadName(name: string): string {
  return name
    .replace(/\b(?:jalan|jln?|jl)\.?\s*/gi, '')
    .replace(/\bds\.?(?=\s|$|[-/()])/gi, 'desa ')
    .replace(/\bsimp(?:ang)?\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*empat\b/gi, 'sp 4')
    .replace(/\bsp\.?\s*0*4\b/gi, 'sp 4')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getMapExplorerRoadKey(name: string | null | undefined): string {
  if (!name) return 'unknown';
  return getRoadKey({ road_name: preprocessMapExplorerRoadName(name) });
}

export function buildMapExplorerRankingLookup(rows: RankingRow[]): Map<string, RankingRow[]> {
  const lookup = new Map<string, RankingRow[]>();

  rows.forEach((row) => {
    const key = getMapExplorerRoadKey(row.road_name);
    const bucket = lookup.get(key);
    if (bucket) bucket.push(row);
    else lookup.set(key, [row]);
  });

  return lookup;
}

export function getMapExplorerAliasCandidate(
  name: string | null | undefined
): { key: string; method: MapExplorerAliasMethod } | null {
  if (!name) return null;

  const sourceKey = getMapExplorerRoadKey(name);
  for (const [sourceName, aliasEntry] of Object.entries(MAP_EXPLORER_ROAD_ALIASES)) {
    if (getMapExplorerRoadKey(sourceName) === sourceKey) {
      return {
        key: getMapExplorerRoadKey(aliasEntry.target),
        method: aliasEntry.method,
      };
    }
  }

  return null;
}

export function getMapExplorerRefAliasCandidate(
  ref: string | null | undefined,
  roadName: string | null | undefined
): { key: string; method: Extract<MapExplorerAliasMethod, 'manual_ref_alias'> } | null {
  if (!ref || !roadName) return null;

  const entry = MAP_EXPLORER_ROAD_REF_ALIASES.find(
    (candidate) => candidate.ref === ref && candidate.roadName === roadName
  );
  if (!entry) return null;

  return {
    key: getMapExplorerRoadKey(entry.target),
    method: entry.method,
  };
}

function resolveCandidate(
  lookup: Map<string, RankingRow[]>,
  key: string | null
): CandidateResolution | null {
  if (!key || key === 'unknown') return null;

  const rows = lookup.get(key) || [];
  const deduped = Array.from(
    new Map(rows.map((row) => [`${row.road_id}|${row.road_name}`, row])).values()
  );

  if (deduped.length === 0) return null;
  if (deduped.length === 1) {
    return { key, rankingRow: deduped[0], ambiguousRows: [] };
  }

  return { key, rankingRow: null, ambiguousRows: deduped };
}

function normalizeRawName(name: string | null | undefined): string {
  if (!name) return '';
  return normalizeRoadIdentity(preprocessMapExplorerRoadName(name));
}

export function matchMapExplorerRoad(
  ref: string | null | undefined,
  roadName: string,
  matchedName: string | null | undefined,
  rankingLookup: Map<string, RankingRow[]>
): MapExplorerMatchResult {
  const directKey = getMapExplorerRoadKey(roadName);
  const refAliasCandidate = getMapExplorerRefAliasCandidate(ref, roadName);
  const aliasCandidate = getMapExplorerAliasCandidate(roadName);
  const aliasKey = aliasCandidate?.key || null;
  const refAliasKey = refAliasCandidate?.key || null;
  const matchedNameKey =
    matchedName && normalizeRawName(matchedName) !== normalizeRawName(roadName)
      ? getMapExplorerRoadKey(matchedName)
      : null;

  const direct = resolveCandidate(rankingLookup, directKey);
  if (direct?.rankingRow) {
    return {
      rankingRow: direct.rankingRow,
      matchMethod: 'direct',
      diagnostics: {
        mapRoadName: roadName,
        normalizedMapKey: directKey,
        aliasKey,
        matchedName: matchedName || null,
        matchedNameKey,
        matchedRankingName: direct.rankingRow.road_name,
        matchedRankingKey: direct.key,
        matchMethod: 'direct',
        ambiguousRankingNames: [],
      },
    };
  }

  const refAlias =
    refAliasKey && refAliasKey !== directKey ? resolveCandidate(rankingLookup, refAliasKey) : null;
  const alias = aliasKey && aliasKey !== directKey ? resolveCandidate(rankingLookup, aliasKey) : null;
  const matchedNameCandidate =
    matchedNameKey && matchedNameKey !== directKey
      ? resolveCandidate(rankingLookup, matchedNameKey)
      : null;

  const ambiguityRows = [
    ...(direct?.ambiguousRows || []),
    ...(refAlias?.ambiguousRows || []),
    ...(alias?.ambiguousRows || []),
    ...(matchedNameCandidate?.ambiguousRows || []),
  ];
  const nonDirectMatches = [refAlias, alias, matchedNameCandidate]
    .filter((candidate): candidate is CandidateResolution => !!candidate?.rankingRow)
    .map((candidate) => candidate.rankingRow!);
  const uniqueNonDirectMatches = Array.from(
    new Map(nonDirectMatches.map((row) => [`${row.road_id}|${row.road_name}`, row])).values()
  );

  if (ambiguityRows.length > 0 || uniqueNonDirectMatches.length > 1) {
    return {
      rankingRow: null,
      matchMethod: 'ambiguous',
      diagnostics: {
        mapRoadName: roadName,
        normalizedMapKey: directKey,
        aliasKey,
        matchedName: matchedName || null,
        matchedNameKey,
        matchedRankingName: null,
        matchedRankingKey: null,
        matchMethod: 'ambiguous',
        ambiguousRankingNames: Array.from(
          new Set([
            ...ambiguityRows.map((row) => row.road_name),
            ...uniqueNonDirectMatches.map((row) => row.road_name),
          ])
        ),
      },
    };
  }

  if (refAlias?.rankingRow) {
    return {
      rankingRow: refAlias.rankingRow,
      matchMethod: refAliasCandidate?.method || 'manual_ref_alias',
      diagnostics: {
        mapRoadName: roadName,
        normalizedMapKey: directKey,
        aliasKey,
        matchedName: matchedName || null,
        matchedNameKey,
        matchedRankingName: refAlias.rankingRow.road_name,
        matchedRankingKey: refAlias.key,
        matchMethod: refAliasCandidate?.method || 'manual_ref_alias',
        ambiguousRankingNames: [],
      },
    };
  }

  if (alias?.rankingRow) {
    const aliasMethod = aliasCandidate?.method || 'alias';
    return {
      rankingRow: alias.rankingRow,
      matchMethod: aliasMethod,
      diagnostics: {
        mapRoadName: roadName,
        normalizedMapKey: directKey,
        aliasKey,
        matchedName: matchedName || null,
        matchedNameKey,
        matchedRankingName: alias.rankingRow.road_name,
        matchedRankingKey: alias.key,
        matchMethod: aliasMethod,
        ambiguousRankingNames: [],
      },
    };
  }

  if (matchedNameCandidate?.rankingRow) {
    return {
      rankingRow: matchedNameCandidate.rankingRow,
      matchMethod: 'matched_name',
      diagnostics: {
        mapRoadName: roadName,
        normalizedMapKey: directKey,
        aliasKey,
        matchedName: matchedName || null,
        matchedNameKey,
        matchedRankingName: matchedNameCandidate.rankingRow.road_name,
        matchedRankingKey: matchedNameCandidate.key,
        matchMethod: 'matched_name',
        ambiguousRankingNames: [],
      },
    };
  }

  return {
    rankingRow: null,
    matchMethod: 'unmatched',
    diagnostics: {
      mapRoadName: roadName,
      normalizedMapKey: directKey,
      aliasKey,
      matchedName: matchedName || null,
      matchedNameKey,
      matchedRankingName: null,
      matchedRankingKey: null,
      matchMethod: 'unmatched',
      ambiguousRankingNames: [],
    },
  };
}
