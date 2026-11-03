import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyMessage } from "@/lib/queryClient";
import { api, fmtData } from "@/lib/painel";

const mascaraCpf = (v) =>
  v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

export default function Consulta() {
  const [protocolo, setProtocolo] = useState(() => new URLSearchParams(window.location.search).get("protocolo") || "");
  const [cpf, setCpf] = useState("");
  const consulta = useMutation({
    mutationFn: () => api("POST", "/api/consulta", { protocolo, cpf }),
    onError: () => {}
  });
  const r = consulta.data;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Acompanhar solicitação</CardTitle>
            <CardDescription>Informe o protocolo recebido ao enviar o pedido e o CPF do solicitante.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-3 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                consulta.mutate();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="c-prot">Protocolo</Label>
                <Input id="c-prot" required value={protocolo} onChange={(e) => setProtocolo(e.target.value.toUpperCase())} placeholder="AG-000000" maxLength={9} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="c-cpf">CPF</Label>
                <Input id="c-cpf" required inputMode="numeric" value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <Button type="submit" className="gap-2" disabled={consulta.isPending}>
                <Search className="h-4 w-4" aria-hidden="true" /> {consulta.isPending ? "Consultando…" : "Consultar"}
              </Button>
            </form>
            {consulta.isError && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {friendlyMessage(consulta.error)}
              </p>
            )}
          </CardContent>
        </Card>

        {r && (
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle className="text-xl">{r.situacao}</CardTitle>
              <CardDescription>
                Protocolo {r.protocolo} · Processo {r.numeroProcesso} · solicitado em {fmtData(r.solicitadoEm)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-slate-200 ml-2 space-y-3">
                {r.historico.map((h, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-primary" aria-hidden="true" />
                    <div className="text-sm font-medium text-slate-900">{h.situacao}</div>
                    <div className="text-xs text-slate-600">{fmtData(h.data)}</div>
                  </li>
                ))}
              </ol>
              {r.situacao.startsWith("Disponível") && (
                <p className="mt-4 rounded-md bg-sky-50 p-3 text-sm text-sky-900">
                  O processo está disponível para consulta no setor de Atendimento do Arquivo Geral.
                </p>
              )}
            </CardContent>
          </Card>
        )}
        <div className="text-center">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Fazer nova solicitação
          </Link>
        </div>
      </main>
    </div>
  );
}
