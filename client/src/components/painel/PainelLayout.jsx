import { useMutation } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { api, roleLabel } from "@/lib/painel";

export function PainelLayout({ usuario, titulo, descricao, icone: Icone, children }) {
  const sair = useMutation({
    mutationFn: () => api("POST", "/api/auth/logout"),
    onSettled: () => {
      queryClient.clear();
      window.location.assign("/admin");
    }
  });
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-3">
                {Icone && (
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icone className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif text-slate-900">{titulo}</h1>
                  {descricao && <p className="text-sm text-slate-600">{descricao}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-right">
                  <div className="font-medium text-slate-900">{usuario.name}</div>
                  <div className="text-xs text-slate-500">
                    {roleLabel(usuario.role)}
                    {usuario.matricula ? ` · Mat. ${usuario.matricula}` : ""}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => sair.mutate()} disabled={sair.isPending}>
                  <LogOut className="h-4 w-4 mr-1.5" aria-hidden="true" /> Sair
                </Button>
              </div>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500" role="status">
      Carregando…
    </div>
  );
}
