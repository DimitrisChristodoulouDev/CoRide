export function parseAuthCallback(raw: string, expected: string) {
  const url = new URL(raw),
    target = new URL(expected);
  const isTarget =
    url.protocol === target.protocol &&
    url.host === target.host &&
    url.pathname === target.pathname;
  if (!isTarget) return null;
  const query = new URLSearchParams(url.search),
    hash = new URLSearchParams(url.hash.slice(1));
  const error =
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error");
  return { code: query.get("code") || hash.get("code"), error };
}
