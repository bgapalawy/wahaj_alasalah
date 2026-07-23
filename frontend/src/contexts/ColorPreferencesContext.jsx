import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ITEM_STATUS_COLORS } from "../config/itemStatusColors.js";
import { SCHEDULE_STATUS_COLORS, INVOICE_STATUS_COLORS } from "../config/scheduleInvoiceColors.js";
import { VILLA_STATUS_COLORS } from "../config/mapConfig.js";
import { hashToHexColor } from "../utils/colorHash.js";

const STORAGE_KEY = "wajha-color-overrides-v1";

const DEFAULTS = {
  status: ITEM_STATUS_COLORS,
  schedule: SCHEDULE_STATUS_COLORS,
  invoice: INVOICE_STATUS_COLORS,
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
  // "specialQueryColumn:<column>" mode key instead, with a deterministic
  // hash-based default color for any value that hasn't been customized.
  const getColumnColors = useCallback(
    (column, values) => {
      const key = `specialQueryColumn:${column}`;
      const saved = overrides[key] ?? {};
      const result = {};
      values.forEach((v) => {
        result[v] = saved[v] ?? hashToHexColor(String(v));
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
