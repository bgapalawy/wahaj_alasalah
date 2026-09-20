// config/projectConfig.js
//
// Single source of truth for the project's display name — used to be
// hardcoded as "Sahms ElGhroub" in 5 separate places (AuthGate header,
// App.jsx header + PDF filenames, MapView's PDF title, and
// renderPrintableMap's fallback title). Now every project deployed from
// this shared codebase just edits this one file.
//
// This is a PROJECT-SPECIFIC file — it does NOT go in the shared
// template repo. Each project's own repo has its own version of this
// file with its own values.

export const projectConfig = {
  // Shown in the login page title and the app header.
  displayName: "WAHJ Alasalah",

  // Used to build PDF export filenames — keep it filesystem-safe (no
  // spaces or special characters), matching the old "ShamsElGhroub_..."
  // convention so exported file names stay clean.
  fileNamePrefix: "WahjAlasalah",

  // Shown as the title text baked into exported map/site PDFs.
  pdfTitleSuffix: " — Site Map",
};
