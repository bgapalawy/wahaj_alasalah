// Keep this in sync with backend/src/config/uploadLimits.js — duplicated
// because frontend and backend are separate packages/deployments. The
// backend is the source of truth and re-validates regardless; this just
// lets us fail fast in the UI before spending a network round trip.
export const MAX_UPLOAD_SIZE_MB = 15;
