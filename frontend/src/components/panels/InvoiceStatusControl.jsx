import { useEffect, useState } from "react";
import { villasApi } from "../../api/villas.js";
import { INVOICE_STATUS_ORDER } from "../../config/scheduleInvoiceColors.js";

/**
 * Ports the original app's "Invoices status" radio-button section from
 * left_click.js: NotStarted / ReadyToPay / InProgress / Paid, manually
 * settable per villa/item. Automatically set to "ReadyToPay" server-side
 * whenever the activity itself transitions to Completed (see
 * invoiceService.autoUpdateInvoiceOnCompletion) — this control is for
 * moving it further (e.g. marking it Paid) or manually overriding it.
 */
export function InvoiceStatusControl({ villaID, tableItemId, onSaved }) {
  const [current, setCurrent] = useState(null);
  const [draftStatus, setDraftStatus] = useState("NotStarted");
  const [state, setState] = useState("loading"); // loading | ready | saving | error
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    villasApi
      .getInvoiceStatus(villaID, tableItemId)
      .then((data) => {
        if (cancelled) return;
        setCurrent(data.status);
        setDraftStatus(data.status ?? "NotStarted");
        setState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err.message);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [villaID, tableItemId]);

  async function handleSave() {
    // Matches the original app's warning when un-completing an activity
    // that was already Paid — here it's the direct case: about to move
    // an invoice AWAY from Paid.
    if (current === "Paid" && draftStatus !== "Paid") {
      const confirmed = window.confirm(
        `This invoice was already marked "Paid". Are you sure you want to change it to "${draftStatus}"?`
      );
      if (!confirmed) return;
    }

    setState("saving");
    setErrorMessage(null);
    try {
      const result = await villasApi.updateInvoiceStatus(villaID, tableItemId, draftStatus);
      setCurrent(result.status);
      setState("ready");
      onSaved?.(tableItemId, result.status);
    } catch (err) {
      setErrorMessage(err.message);
      setState("error");
    }
  }

  if (state === "loading") return <p className="activity-status-hint">Loading invoice status…</p>;

  return (
    <div className="activity-status-control">
      <h3>Invoice status</h3>
      {current && (
        <p className="activity-status-current">
          Current: <strong>{current}</strong>
        </p>
      )}

      <div className="activity-status-form">
        <select value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
          {INVOICE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleSave} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </button>
      </div>

      {state === "error" && <p className="upload-error">{errorMessage}</p>}
    </div>
  );
}
