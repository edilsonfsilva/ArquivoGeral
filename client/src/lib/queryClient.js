import { QueryClient, MutationCache } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

async function throwIfResNotOk(res) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const err = new Error(`${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
}

// Extrai a mensagem amigável enviada pelo servidor ({ message }).
function friendlyMessage(err) {
  const body = String(err?.message || "").replace(/^\d+:\s*/, "");
  try {
    return JSON.parse(body).message || "Erro inesperado.";
  } catch {
    return body || "Erro inesperado.";
  }
}

// Sessão expirada no painel: volta para o login.
function handleUnauthorized(err) {
  const interno = /^\/(admin\/|atendimento|busca|gerencia|certidao)/.test(window.location.pathname);
  if (err?.status === 401 && interno) {
    queryClient.clear();
    window.location.assign("/admin");
    return true;
  }
  return false;
}

async function apiRequest(method, url, data) {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : void 0,
    credentials: "include"
  });
  await throwIfResNotOk(res);
  return res;
}

const getQueryFn = ({ on401: unauthorizedBehavior }) => async ({ queryKey }) => {
  const res = await fetch(queryKey.join("/"), {
    credentials: "include"
  });
  if (unauthorizedBehavior === "returnNull" && res.status === 401) {
    return null;
  }
  await throwIfResNotOk(res);
  return await res.json();
};

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (handleUnauthorized(err)) return;
      // Formulários que já tratam o próprio erro não recebem toast duplicado.
      if (mutation.options.onError) return;
      toast({ title: "Não foi possível concluir", description: friendlyMessage(err), variant: "destructive" });
    }
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false
    },
    mutations: {
      retry: false
    }
  }
});

export { apiRequest, getQueryFn, queryClient, friendlyMessage };
