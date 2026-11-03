import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api, fmtData } from "@/lib/painel";
import { podeEditarModelos } from "@shared/workflow.js";

function EditorModelo({ modelo, editavel }) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState(modelo.titulo);
  const [texto, setTexto] = useState(modelo.texto);
  useEffect(() => {
    setTitulo(modelo.titulo);
    setTexto(modelo.texto);
  }, [modelo.titulo, modelo.texto]);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["/api/certidoes/modelos"] });
  const salvar = useMutation({
    mutationFn: () => api("PUT", `/api/certidoes/modelos/${modelo.tipo}`, { titulo, texto }),
    onSuccess: () => {
      atualizar();
      toast({ title: "Modelo salvo", description: "As próximas certidões usarão este texto." });
    }
  });
  const restaurar = useMutation({
    mutationFn: () => api("DELETE", `/api/certidoes/modelos/${modelo.tipo}`),
    onSuccess: () => {
      atualizar();
      toast({ title: "Modelo padrão restaurado" });
    }
  });
  const alterado = titulo !== modelo.titulo || texto !== modelo.texto;
  const id = `modelo-${modelo.tipo}`;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          {modelo.padrao.titulo}
          <span className="text-xs font-normal text-slate-500">
            {modelo.personalizado ? `Personalizado por ${modelo.atualizadoPor} em ${fmtData(modelo.atualizadoEm)}` : "Modelo padrão"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`${id}-titulo`}>Título</Label>
          <Input id={`${id}-titulo`} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} disabled={!editavel} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-texto`}>Texto</Label>
          <Textarea id={`${id}-texto`} value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={4000} disabled={!editavel} />
        </div>
        {editavel && (
          <div className="flex flex-wrap gap-2 justify-end">
            {modelo.personalizado && (
              <Button variant="outline" size="sm" onClick={() => restaurar.mutate()} disabled={restaurar.isPending}>
                Restaurar padrão
              </Button>
            )}
            <Button size="sm" onClick={() => salvar.mutate()} disabled={!alterado || salvar.isPending}>
              {salvar.isPending ? "Salvando…" : "Salvar modelo"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Modelos de certidão personalizáveis (chefe do Atendimento e Gerente editam; servidores consultam). */
export function ModelosCertidao({ usuario }) {
  const { data, isLoading } = useQuery({ queryKey: ["/api/certidoes/modelos"], staleTime: 0 });
  if (isLoading || !data) return <p className="text-sm text-slate-500" role="status">Carregando modelos…</p>;
  const editavel = podeEditarModelos(usuario.role);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 text-sm text-slate-700 space-y-2">
        <p>
          Personalize o título e o texto de cada certidão. As alterações valem para as <strong>próximas</strong> emissões; certidões já
          emitidas não mudam. Abaixo do texto, a certidão continua trazendo a tabela com os dados do processo, a assinatura do servidor
          e o código de verificação.
        </p>
        <p>Campos automáticos que podem ser usados no texto:</p>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(data.campos).map(([k, label]) => (
            <li key={k} className="rounded bg-slate-100 px-2 py-0.5 text-xs">
              <code>{`{${k}}`}</code> {label}
            </li>
          ))}
        </ul>
      </div>
      {data.modelos.map((m) => (
        <EditorModelo key={m.tipo} modelo={m} editavel={editavel} />
      ))}
    </div>
  );
}
