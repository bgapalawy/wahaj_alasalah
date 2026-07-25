const cache = new Map();

/**
 * Multiple components independently fetching the same static resource
 * (villa-parcels.geojson, in particular — used by the map itself AND
 * useVillaGeoMeta.js, which alone is used in 3 more components) was
 * showing up as repeated network round-trips in production, each
 * costing hundreds of ms even when served from the browser's HTTP
 * cache (a 304 still needs a full request/response round-trip). This
 * memoizes the in-flight/resolved promise per URL so the fetch only
 * ever actually happens once per page session, no matter how many
 * components ask for it.
 */
export function cachedJsonFetch(url) {
  if (!cache.has(url)) {
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
        return res.json();
      })
      .catch((err) => {
        cache.delete(url); // don't cache a failure — let the next caller retry
        throw err;
      });
    cache.set(url, promise);
  }
  return cache.get(url);
}
