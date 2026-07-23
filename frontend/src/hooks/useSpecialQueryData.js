import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "../api/dashboard.js";

/**
 * The original app's actual custom-query data source: wajha_special_query,
 * a table whose columns aren't fixed ahead of time — the original
 * discovered them at runtime (getdynamoDBClientColumns) rather than
 * hardcoding a field list. This does the same: fetch the raw records
 * once, then derive the available columns and each column's distinct
 * values straight from whatever's actually in the table.
 */
export function useSpecialQueryData(enabled) {
  const [records, setRecords] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error

  useEffect(() => {
    if (!enabled || records) return;
    let cancelled = false;
    setStatus("loading");
    dashboardApi
      .getSpecialQueryData()
      .then((data) => {
        if (cancelled) return;
        setRecords(data);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Every column except villaID (the primary key, used for matching, not
  // itself a filterable "value" column), and every distinct value that
  // column actually has across the table.
  const columns = useMemo(() => {
    if (!records || records.length === 0) return [];
    const keys = new Set();
    records.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    keys.delete("villaID");
    return [...keys].sort();
  }, [records]);

  const valuesByColumn = useMemo(() => {
    if (!records) return {};
    const result = {};
    columns.forEach((col) => {
      result[col] = [...new Set(records.map((r) => r[col]).filter((v) => v !== undefined && v !== null && v !== ""))].sort();
    });
    return result;
  }, [records, columns]);

  // villaID -> {column: value} — what evaluateCustomQuery actually reads
  // against when a condition references this table.
  const byVilla = useMemo(() => {
    if (!records) return {};
    const result = {};
    records.forEach((r) => {
      if (r.villaID) result[r.villaID] = r;
    });
    return result;
  }, [records]);

  return { columns, valuesByColumn, byVilla, status };
}
