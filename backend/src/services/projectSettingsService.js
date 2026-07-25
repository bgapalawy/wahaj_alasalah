import { query } from "../config/postgres.js";
import { findObjectByPrefix, getDownloadUrl } from "./uploadService.js";

export const LOGO_SLOT_COUNT = 5;

// Fixed, hardcoded prefixes — never derived from client input. This is
// what makes it safe for uploadPrefixValidation.js to special-case as
// always valid: there's exactly LOGO_SLOT_COUNT real values these could
// ever be.
export const BRANDING_LOGO_PREFIXES = Array.from({ length: LOGO_SLOT_COUNT }, (_, i) => `branding-logo-${i + 1}`);

export async function getProjectSettings() {
  const { rows } = await query(
    `SELECT project_name, logo_caption_1, logo_caption_2, logo_caption_3, logo_caption_4, logo_caption_5
     FROM project_settings WHERE id = 1`
  );
  const row = rows[0] ?? {};

  const logos = await Promise.all(
    BRANDING_LOGO_PREFIXES.map(async (prefix, i) => {
      const object = await findObjectByPrefix(prefix);
      const logoUrl = object ? await getDownloadUrl(object.key) : null;
      return { caption: row[`logo_caption_${i + 1}`] ?? null, logoUrl };
    })
  );

  return { projectName: row.project_name ?? null, logos };
}

export async function updateProjectSettings({ projectName, logoCaptions }) {
  const captions = Array.from({ length: LOGO_SLOT_COUNT }, (_, i) => logoCaptions?.[i] ?? null);
  await query(
    `INSERT INTO project_settings
       (id, project_name, logo_caption_1, logo_caption_2, logo_caption_3, logo_caption_4, logo_caption_5, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET
       project_name = EXCLUDED.project_name,
       logo_caption_1 = EXCLUDED.logo_caption_1,
       logo_caption_2 = EXCLUDED.logo_caption_2,
       logo_caption_3 = EXCLUDED.logo_caption_3,
       logo_caption_4 = EXCLUDED.logo_caption_4,
       logo_caption_5 = EXCLUDED.logo_caption_5,
       updated_at = now()`,
    [projectName ?? null, ...captions]
  );
  return getProjectSettings();
}
