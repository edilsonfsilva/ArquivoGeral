import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyMessage } from "@/lib/queryClient";
import { fmtData } from "@/lib/painel";

export default function Verificar() {
  const params = useParams();
  const [codigo, setCodigo] = useState(params.codigo || "");
  const verificar = useMutation({
    mutationFn: async (c) => {
      const res = await fetch(`/api/certidoes/verificar/${encodeURIComponent(c.trim().toUpperCase())}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(body)}`);
      return body;
    },
    onError: () => {}
  });
  useEffect(() => {
    if (params.codigo) verificar.mutate(params.codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.codigo]);
  const c = verificar.data;

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Verificar certidão</CardTitle>
            <CardDescription>Digite o código de verificação impresso no rodapé da certidão.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                verificar.mutate(codigo);
              }}
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor="v-cod">Código</Label>
                <Input id="v-cod" required value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={12} />
              </div>
              <Button type="submit" disabled={verificar.isPending}>
                Verificar
              </Button>
            </form>
            {verificar.isError && (
              <p className="mt-4 text-sm text-red-700" role="alert">
                {friendlyMessage(verificar.error)}
              </p>
            )}
          </CardContent>
        </Card>
        {c && (
          <Card className="border-emerald-300" aria-live="polite">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Certidão encontrada
              </CardTitle>
              <CardDescription>Confira se os dados abaixo são os mesmos do documento apresentado.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-slate-500">Documento</dt><dd className="font-medium">{c.titulo}</dd></div>
                <div><dt className="text-slate-500">Número</dt><dd className="font-medium">{c.numero}</dd></div>
                <div><dt className="text-slate-500">Processo</dt><dd>{c.numeroProcesso}</dd></div>
                <div><dt className="text-slate-500">Protocolo</dt><dd>{c.protocolo}</dd></div>
                <div><dt className="text-slate-500">Emitida em</dt><dd>{fmtData(c.emitidaEm)}</dd></div>
                <div><dt className="text-slate-500">Emitida por</dt><dd>{c.servidor}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-amber-800 bg-amber-50 rounded p-2">
                Ambiente de protótipo para validação do fluxo: esta certidão não tem validade oficial.
              </p>
            </CardContent>
          </Card>
        )}
        <div className="text-center">
          <Link href="/" className="text-sm text-primary hover:underline">← Início</Link>
        </div>
      </main>
    </div>
  );
}
