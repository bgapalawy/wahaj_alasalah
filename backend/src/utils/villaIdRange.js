// Real villas are named "V_1" through "V_590". The underlying DynamoDB
// tables also contain other rows (e.g. a villaID of literally "id") used
// for testing/enhancing the database — not real production villas. This
// filters those out everywhere villas get listed in bulk.
export const VILLA_ID_MIN = 1;
export const VILLA_ID_MAX = 590;

const VILLA_ID_PATTERN = /^V_(\d+)$/;

export function isValidVillaID(villaID) {
  const match = typeof villaID === "string" ? villaID.match(VILLA_ID_PATTERN) : null;
  if (!match) return false;
  const n = Number(match[1]);
  return n >= VILLA_ID_MIN && n <= VILLA_ID_MAX;
}
