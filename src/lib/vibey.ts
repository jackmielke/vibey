// Single source of truth for the Vibey agent.
// Until auth + multi-agent support land, the whole app reads/writes this one row.
export const VIBEY_AGENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
export const VIBEY_COMMUNITY_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
export const VIBE_CODE_RESIDENCY_COMMUNITY_ID = "4202857f-13fd-4407-8906-3f8ffe63e510";
export const EDGE_ESMERELDA_COMMUNITY_ID = "bb93af8f-3d13-458e-a580-207d374bbe39";
// Communities the people directory aggregates across.
export const DIRECTORY_COMMUNITY_IDS = [
  VIBEY_COMMUNITY_ID,
  EDGE_ESMERELDA_COMMUNITY_ID,
];
