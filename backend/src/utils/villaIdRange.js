// Real villas are named "V_<number>". The underlying DynamoDB tables also
// contain other rows (e.g. a villaID of literally "id") used for
// testing/enhancing the database — not real production villas. This
// filters those out everywhere villas get listed in bulk.
//
// VILLA_ID_MAX used to be 590 — that was how many rows happened to exist
// in the database at the time, not the true size of the site. The real
// GeoJSON has ~1,540 villa parcels, most of which aren't in the database
// yet (data entry is still catching up). Widened generously so real
// villas added later (up to V_5000) aren't wrongly filtered out; the
// regex + MIN check still reject genuine junk like "id".
export const VILLA_ID_MIN = 1;
export const VILLA_ID_MAX = 5000;

const VILLA_ID_PATTERN = /^V_(\d+)$/;

export function isValidVillaID(villaID) {
  const match = typeof villaID === "string" ? villaID.match(VILLA_ID_PATTERN) : null;
  if (!match) return false;
  const n = Number(match[1]);
  return n >= VILLA_ID_MIN && n <= VILLA_ID_MAX;
}
