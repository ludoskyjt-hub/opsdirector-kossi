const OPS_TOKEN_KEY = "ops_token";
const OPS_CACHE_KEY = "ops-rq-cache-v2";

export function getOpsToken(): string | null {
  return localStorage.getItem(OPS_TOKEN_KEY);
}

export function setOpsToken(token: string) {
  localStorage.setItem(OPS_TOKEN_KEY, token);
  // Clear the RQ cache so stale unauthenticated data (auth.me = null)
  // doesn't prevent the post-login refetch from running.
  localStorage.removeItem(OPS_CACHE_KEY);
}

export function clearOpsToken() {
  localStorage.removeItem(OPS_TOKEN_KEY);
  localStorage.removeItem(OPS_CACHE_KEY);
}
