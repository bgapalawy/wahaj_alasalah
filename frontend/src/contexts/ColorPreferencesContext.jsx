import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ITEM_STATUS_COLORS } from "../config/itemStatusColors.js";
import { SCHEDULE_STATUS_COLORS, INVOICE_STATUS_COLORS, OUT_OF_SEQUENCE_COLORS } from "../config/scheduleInvoiceColors.js";
import { VILLA_STATUS_COLORS } from "../config/mapConfig.js";

const STORAGE_KEY = "shams_elgroub-color-overrides-v1";

// Fixed set of visually distinct colors used to auto-color Special
// Query / Column-mode values by position (see getColumnColors below).
// Chosen to be distinguishable from each other at a glance, including
// on a map's small parcel fills. Cycles (repeats) if a column ever has
// more distinct values than this palette — rare, and still far better
// than hash collisions landing two common values on the same color.
const COLUMN_VALUE_PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#ea580c", "#7c3aed", "#0891b2",
  "#ca8a04", "#db2777", "#4338ca", "#059669", "#b91c1c", "#c026d3",
  "#0d9488", "#65a30d", "#9333ea", "#e11d48", "#0284c7", "#d97706",
  "#15803d", "#be185d", "#4f46e5", "#0f766e", "#a21caf", "#78716c",
];

const DEFAULTS = {
  status: ITEM_STATUS_COLORS,
  schedule: SCHEDULE_STATUS_COLORS,
  invoice: INVOICE_STATUS_COLORS,
  outOfSequence: OUT_OF_SEQUENCE_COLORS,
  overallStatus: VILLA_STATUS_COLORS,
  customQuery: { match: "#2563eb", noMatch: "#d1d5db" },
};

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const ColorPreferencesContext = createContext(null);

/**
 * Lets the user recolor the status/schedule/invoice/overall-status
 * legend keys used everywhere across the map and dashboards, persisted
 * in the browser (localStorage — this is a real deployed app, not an
 * Artifact, so that's fine here). Every color-consuming component reads
 * through this context instead of importing the static config objects
 * directly, so a change here shows up everywhere at once: the map's
 * fill colors and legend, every dashboard pie, the By Item tab, and the
 * printed PDF (MapView passes the resolved palette into
 * renderPrintableMap already).
 */
export function ColorPreferencesProvider({ children }) {
  const [overrides, setOverrides] = useState(loadOverrides);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // Storage full or unavailable — the color choice just won't persist
      // across reloads, not worth surfacing an error for.
    }
  }, [overrides]);

  const setColor = useCallback((mode, key, color) => {
    setOverrides((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [key]: color },
    }));
  }, []);

  const resetMode = useCallback((mode) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[mode];
      return next;
    });
  }, []);

  const getColors = useCallback(
    (mode) => ({ ...DEFAULTS[mode], ...overrides[mode] }),
    [overrides]
  );

  // Special-query column values are completely dynamic (any column can
  // have any values) so they can't live in the fixed DEFAULTS object the
  // way Status/Schedule/Invoice do. Stored under a synthetic
  // "specialQueryColumn:<column>" mode key instead.
  //
  // Default colors are assigned BY POSITION from a fixed palette of
  // visually distinct hues, not by hashing each value's own text —
  // hashing short/similar strings (e.g. "10", "7", "8", "(no value)")
  // can land on the same or a near-identical color, which is exactly the
  // "everything's the same color by default" problem this replaced.
  // Deterministic: the same values list always gets the same colors,
  // and a user's manual override (setColumnColor) still always wins.
  const getColumnColors = useCallback(
    (column, values) => {
      const key = `specialQueryColumn:${column}`;
      const saved = overrides[key] ?? {};
      const result = {};
      values.forEach((v, i) => {
        result[v] = saved[v] ?? COLUMN_VALUE_PALETTE[i % COLUMN_VALUE_PALETTE.length];
      });
      return result;
    },
    [overrides]
  );

  const setColumnColor = useCallback((column, value, color) => {
    const key = `specialQueryColumn:${column}`;
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], [value]: color },
    }));
  }, []);

  const resetColumnColors = useCallback((column) => {
    const key = `specialQueryColumn:${column}`;
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <ColorPreferencesContext.Provider
      value={{ getColors, setColor, resetMode, defaults: DEFAULTS, getColumnColors, setColumnColor, resetColumnColors }}
    >
      {children}
    </ColorPreferencesContext.Provider>
  );
}

export function useColorPreferences() {
  const ctx = useContext(ColorPreferencesContext);
  if (!ctx) {
    throw new Error("useColorPreferences must be used within a ColorPreferencesProvider");
  }
  return ctx;
}
