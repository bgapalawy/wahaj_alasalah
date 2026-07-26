/**
 * Minimal Arabic text shaper for jsPDF.
 *
 * jsPDF embeds TrueType fonts by mapping each Unicode codepoint straight to
 * a glyph via the font's cmap table — it does NOT run the font's GSUB
 * contextual-shaping rules the way a browser or a real text-layout engine
 * (HarfBuzz, CoreText, etc.) would. Handed raw Arabic text, jsPDF renders
 * every letter in its isolated form with no joining strokes, which reads as
 * broken/wrong to an Arabic reader. The fix is to pre-shape the text
 * ourselves: swap each base letter for its correct isolated / initial /
 * medial / final Arabic Presentation Forms-B codepoint (which the embedded
 * font also has real glyphs for — see NotoSansArabic-Regular.ttf), so jsPDF
 * only ever needs to do the dumb 1:1 cmap lookup it's actually capable of.
 *
 * jsPDF also lays out characters left-to-right in memory order with no
 * bidi reordering, so a shaped-but-not-reversed string still renders back
 * to front. reverse() below undoes that for a pure-RTL string (fine for
 * these construction-item labels, which are Arabic + a plain "-" — not a
 * general-purpose bidi algorithm for mixed Arabic/Latin/number runs).
 *
 * Adapted (letter-form table, ligature table, and shaping loop) from the
 * `arabic-persian-reshaper` npm package by Shen Yiming, with Arabic-only
 * additions by Alex Clay — MIT licensed:
 *   https://github.com/soimy/arabic-persian-reshaper
 *   https://github.com/alex-clay/arabic-persian-reshaper
 * Trimmed here to Arabic-only (no Persian) and to just what these labels
 * need (no reverse-conversion back to plain Arabic).
 */

// [baseCode, isolated, initial, medial, final]
const CHARS_MAP = [
  [0x0621, 0xFE80, null, null, null], // HAMZA
  [0x0622, 0xFE81, null, null, 0xFE82], // ALEF_MADDA
  [0x0623, 0xFE83, null, null, 0xFE84], // ALEF_HAMZA_ABOVE
  [0x0624, 0xFE85, null, null, 0xFE86], // WAW_HAMZA
  [0x0625, 0xFE87, null, null, 0xFE88], // ALEF_HAMZA_BELOW
  [0x0626, 0xFE89, 0xFE8B, 0xFE8C, 0xFE8A], // YEH_HAMZA
  [0x0627, 0xFE8D, null, null, 0xFE8E], // ALEF
  [0x0628, 0xFE8F, 0xFE91, 0xFE92, 0xFE90], // BEH
  [0x0629, 0xFE93, null, null, 0xFE94], // TEH_MARBUTA
  [0x062A, 0xFE95, 0xFE97, 0xFE98, 0xFE96], // TEH
  [0x062B, 0xFE99, 0xFE9B, 0xFE9C, 0xFE9A], // THEH
  [0x062C, 0xFE9D, 0xFE9F, 0xFEA0, 0xFE9E], // JEEM
  [0x062D, 0xFEA1, 0xFEA3, 0xFEA4, 0xFEA2], // HAH
  [0x062E, 0xFEA5, 0xFEA7, 0xFEA8, 0xFEA6], // KHAH
  [0x062F, 0xFEA9, null, null, 0xFEAA], // DAL
  [0x0630, 0xFEAB, null, null, 0xFEAC], // THAL
  [0x0631, 0xFEAD, null, null, 0xFEAE], // REH
  [0x0632, 0xFEAF, null, null, 0xFEB0], // ZAIN
  [0x0698, 0xFB8A, null, null, 0xFB8B], // ZHEH
  [0x0633, 0xFEB1, 0xFEB3, 0xFEB4, 0xFEB2], // SEEN
  [0x0634, 0xFEB5, 0xFEB7, 0xFEB8, 0xFEB6], // SHEEN
  [0x0635, 0xFEB9, 0xFEBB, 0xFEBC, 0xFEBA], // SAD
  [0x0636, 0xFEBD, 0xFEBF, 0xFEC0, 0xFEBE], // DAD
  [0x0637, 0xFEC1, 0xFEC3, 0xFEC4, 0xFEC2], // TAH
  [0x0638, 0xFEC5, 0xFEC7, 0xFEC8, 0xFEC6], // ZAH
  [0x0639, 0xFEC9, 0xFECB, 0xFECC, 0xFECA], // AIN
  [0x063A, 0xFECD, 0xFECF, 0xFED0, 0xFECE], // GHAIN
  [0x0640, 0x0640, 0x0640, 0x0640, 0x0640], // TATWEEL
  [0x0641, 0xFED1, 0xFED3, 0xFED4, 0xFED2], // FEH
  [0x0642, 0xFED5, 0xFED7, 0xFED8, 0xFED6], // QAF
  [0x0643, 0xFED9, 0xFEDB, 0xFEDC, 0xFEDA], // KAF
  [0x0644, 0xFEDD, 0xFEDF, 0xFEE0, 0xFEDE], // LAM
  [0x0645, 0xFEE1, 0xFEE3, 0xFEE4, 0xFEE2], // MEEM
  [0x0646, 0xFEE5, 0xFEE7, 0xFEE8, 0xFEE6], // NOON
  [0x0647, 0xFEE9, 0xFEEB, 0xFEEC, 0xFEEA], // HEH
  [0x0648, 0xFEED, null, null, 0xFEEE], // WAW
  [0x0649, 0xFEEF, 0xFBE8, 0xFBE9, 0xFBFD], // ALEF_MAKSURA
  [0x064A, 0xFEF1, 0xFEF3, 0xFEF4, 0xFEF2], // YEH
];

// [[lam, alefVariant], isolated, initial, medial, final]
const COMB_CHARS_MAP = [
  [[0x0644, 0x0622], 0xFEF5, null, null, 0xFEF6], // LAM_ALEF_MADDA
  [[0x0644, 0x0623], 0xFEF7, null, null, 0xFEF8], // LAM_ALEF_HAMZA_ABOVE
  [[0x0644, 0x0625], 0xFEF9, null, null, 0xFEFA], // LAM_ALEF_HAMZA_BELOW
  [[0x0644, 0x0627], 0xFEFB, null, null, 0xFEFC], // LAM_ALEF
];

// Diacritics/marks that don't break letter-joining — a letter before one
// of these should still look at what comes AFTER it for shaping purposes.
const TRANSPARENT_CHARS = new Set([
  0x0610, 0x0612, 0x0613, 0x0614, 0x0615, 0x064B, 0x064C, 0x064D, 0x064E,
  0x064F, 0x0650, 0x0651, 0x0652, 0x0653, 0x0654, 0x0655, 0x0656, 0x0657,
  0x0658, 0x0670, 0x06D6, 0x06D7, 0x06D8, 0x06D9, 0x06DA, 0x06DB, 0x06DC,
  0x06DF, 0x06E0, 0x06E1, 0x06E2, 0x06E3, 0x06E4, 0x06E7, 0x06E8, 0x06EA,
  0x06EB, 0x06EC, 0x06ED,
]);

function getCharRep(code) {
  return CHARS_MAP.find((row) => row[0] === code) || null;
}
function getCombCharRep(c1, c2) {
  return COMB_CHARS_MAP.find((row) => row[0][0] === c1 && row[0][1] === c2) || null;
}

/** Convert plain Arabic text into its shaped Presentation-Forms-B glyphs. */
function shapeArabic(text) {
  let shaped = "";
  for (let i = 0; i < text.length; i++) {
    const current = text.charCodeAt(i);
    const currentRep = getCharRep(current);
    if (!currentRep) {
      shaped += String.fromCharCode(current);
      continue;
    }

    let prevId = i - 1;
    while (prevId >= 0 && TRANSPARENT_CHARS.has(text.charCodeAt(prevId))) prevId--;
    let prev = prevId >= 0 ? text.charCodeAt(prevId) : null;
    if (prev !== null) {
      const prevRep = getCharRep(prev);
      if (!prevRep || (prevRep[2] == null && prevRep[3] == null)) prev = null;
    }

    let nextId = i + 1;
    while (nextId < text.length && TRANSPARENT_CHARS.has(text.charCodeAt(nextId))) nextId++;
    let next = nextId < text.length ? text.charCodeAt(nextId) : null;
    if (next !== null) {
      const nextRep = getCharRep(next);
      if (!nextRep || (nextRep[3] == null && nextRep[4] == null)) next = null;
    }

    // Lam-Alef ligatures (لا and its hamza/madda variants)
    if (current === 0x0644 && next !== null &&
        (next === 0x0622 || next === 0x0623 || next === 0x0625 || next === 0x0627)) {
      const comb = getCombCharRep(current, next);
      shaped += String.fromCharCode(prev !== null ? comb[4] : comb[1]);
      i += 1; // consume the alef too
      continue;
    }

    if (prev !== null && next !== null && currentRep[3] != null) {
      shaped += String.fromCharCode(currentRep[3]); // medial
    } else if (prev !== null && currentRep[4] != null) {
      shaped += String.fromCharCode(currentRep[4]); // final
    } else if (next !== null && currentRep[2] != null) {
      shaped += String.fromCharCode(currentRep[2]); // initial
    } else {
      shaped += String.fromCharCode(currentRep[1]); // isolated
    }
  }
  return shaped;
}

/**
 * Shape + reverse Arabic text for direct use in jsPDF's doc.text(). Only
 * correct for a pure (or Arabic + neutral punctuation/spaces) RTL string —
 * not a general bidi algorithm for mixed Arabic/Latin runs. That's all
 * these construction-item nameArabic labels are, so it's sufficient here.
 */
export function shapeArabicForPdf(text) {
  return [...shapeArabic(text)].reverse().join("");
}
