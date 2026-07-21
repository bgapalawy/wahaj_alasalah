import { useEffect, useState } from "react";
import { villasApi } from "../api/villas.js";

/**
 * Loads villa attribute records from the backend.
 * Replaces the ad-hoc DynamoDB scan + global state pattern from
 * awsFunctions.js / dashboardallproject.js.
 */
export function useVillas() {
  const [villas, setVillas] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    villasApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setVillas(data);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { villas, status, error };
}
