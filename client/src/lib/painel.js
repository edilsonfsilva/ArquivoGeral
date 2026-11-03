import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "./queryClient";
import { STATUS, ROLES } from "@shared/workflow.js";

// Chamada JSON à API (erros viram toast pelo MutationCache global).
export async function api(method, url, body) {
  const res = await apiRequest(method, url, body);
  return res.status === 204 ? null : res.json();
}

// Usuário logado. Sem sessão → volta ao login. Perfil de outro setor → vai para a própria tela.
export function useUsuario(setorEsperado) {
  const [, setLocation] = useLocation();
  const q = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Falha ao carregar usuário");
      return res.json();
    },
    staleTime: 60_000
  });
  useEffect(() => {
    if (q.isLoading) return;
    if (!q.data) setLocation("/admin");
    else if (setorEsperado && q.data.setor !== setorEsperado) setLocation(q.data.tela);
  }, [q.isLoading, q.data, setorEsperado, setLocation]);
  return q;
}

// Lista de pedidos com filtros de servidor (atualiza a cada 30 s para refletir o trabalho do outro setor).
export function usePedidos(filtros = {}) {
  const params = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== "" && v != null));
  const qs = params.toString();
  return useQuery({
    queryKey: ["/api/requests", "lista", qs],
    queryFn: async () => {
      const res = await fetch(`/api/requests${qs ? "?" + qs : ""}`, { credentials: "include" });
      if (res.status === 401) {
        window.location.assign("/admin");
        return [];
      }
      if (!res.ok) throw new Error("Erro ao carregar pedidos");
      return res.json();
    },
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  });
}

export const fmtData = (d) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const fmtDia = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
export const statusLabel = (s) => STATUS[s]?.label || s;
export const roleLabel = (r) => ROLES[r]?.label || r;

// Cor do status conforme o setor com quem o processo está.
export function statusClasse(s) {
  const st = STATUS[s];
  if (!st) return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "arquivado") return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (s === "indeferido" || s === "encerrado") return "bg-slate-100 text-slate-700 border-slate-300";
  if (s === "nao_localizado") return "bg-red-50 text-red-800 border-red-200";
  if (st.setor === "busca") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-sky-50 text-sky-900 border-sky-200";
}

// Atrasa a aplicação de um valor (ex.: texto digitado nos filtros) para não consultar a cada tecla.
export function useDebounced(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
