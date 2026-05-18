import { trpc } from "@/lib/trpc";
import { getOpsToken, clearOpsToken } from "@/lib/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

export { getOpsToken, clearOpsToken };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60_000,
      gcTime: 7 * 24 * 60 * 60_000,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

try {
  const cached = localStorage.getItem("ops-rq-cache-v2");
  if (cached) {
    const { ts, queries } = JSON.parse(cached);
    const maxAge = 7 * 24 * 60 * 60_000;
    if (Date.now() - ts < maxAge) {
      queries.forEach(({ queryKey, data }: any) => {
        queryClient.setQueryData(queryKey, data);
      });
    }
  }
} catch { /* ignore */ }

window.addEventListener("beforeunload", () => {
  try {
    const queries = queryClient.getQueryCache().getAll()
      .filter(q => q.state.data !== undefined)
      .map(q => ({ queryKey: q.queryKey, data: q.state.data }));
    localStorage.setItem("ops-rq-cache-v2", JSON.stringify({ queries, ts: Date.now() }));
  } catch { /* ignore */ }
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.data?.code !== "UNAUTHORIZED") return;
  clearOpsToken();
  const base = import.meta.env.BASE_URL ?? "/ops/";
  window.location.href = base;
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error);
});
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error);
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/ops/trpc",
      transformer: superjson,
      headers() {
        const token = getOpsToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
