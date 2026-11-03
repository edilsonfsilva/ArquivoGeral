import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { UserPlus, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { api, roleLabel } from "@/lib/painel";
import { perfisCriaveis, podeGerenciarUsuario } from "@shared/workflow.js";

const VAZIO = { name: "", email: "", matricula: "", password: "", role: "" };

export function GestaoUsuarios({ usuario }) {
  const { toast } = useToast();
  const criaveis = perfisCriaveis(usuario.role);
  const [form, setForm] = useState(null); // null = fechado; { id? , ...campos }
  const [desativar, setDesativar] = useState(null);
  const lista = useQuery({ queryKey: ["/api/users"], staleTime: 0 });

  const salvar = useMutation({
    mutationFn: ({ id, ...dados }) => {
      if (!id) return api("POST", "/api/users", dados);
      const body = { name: dados.name, email: dados.email, matricula: dados.matricula };
      if (dados.password) body.password = dados.password;
      if (dados.role && criaveis.includes(dados.role)) body.role = dados.role;
      return api("PATCH", `/api/users/${id}`, body);
    },
    onSuccess: (_u, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: vars.id ? "Usuário atualizado" : "Usuário cadastrado" });
      setForm(null);
    }
  });
  const alternar = useMutation({
    mutationFn: (u) => api("PATCH", `/api/users/${u.id}`, { ativo: !u.ativo }),
    onSuccess: (u) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: u.ativo ? "Usuário reativado" : "Usuário desativado" });
      setDesativar(null);
    }
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const editando = !!form?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Você pode cadastrar: {criaveis.map(roleLabel).join(", ")}.
          {usuario.role === "gerente_arquivo" && " Também pode desativar qualquer usuário."}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...VAZIO, role: criaveis[0] })}>
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Novo usuário
        </Button>
      </div>

      {lista.isLoading ? (
        <p className="text-sm text-slate-500" role="status">Carregando…</p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-2 font-medium">Nome</th>
                <th className="p-2 font-medium">E-mail</th>
                <th className="p-2 font-medium">Matrícula</th>
                <th className="p-2 font-medium">Perfil</th>
                <th className="p-2 font-medium">Situação</th>
                <th className="p-2 font-medium sr-only">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(lista.data || []).map((u) => (
                <tr key={u.id} className={u.ativo ? "" : "text-slate-400"}>
                  <td className="p-2">{u.name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.matricula || "—"}</td>
                  <td className="p-2">{roleLabel(u.role)}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={u.ativo ? "text-emerald-800 bg-emerald-50 border-emerald-200" : ""}>
                      {u.ativo ? "Ativo" : "Desativado"}
                    </Badge>
                  </td>
                  <td className="p-2 text-right whitespace-nowrap">
                    {podeGerenciarUsuario(usuario.role, u.role) && u.id !== usuario.id && (
                      <>
                        {criaveis.includes(u.role) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Editar ${u.name}`}
                            onClick={() => setForm({ id: u.id, name: u.name, email: u.email, matricula: u.matricula || "", password: "", role: u.role })}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => (u.ativo ? setDesativar(u) : alternar.mutate(u))}>
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>A senha precisa ter pelo menos 10 caracteres.</DialogDescription>
          </DialogHeader>
          {form && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                salvar.mutate(form);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="u-nome">Nome completo</Label>
                <Input id="u-nome" required value={form.name} onChange={set("name")} maxLength={120} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="u-email">E-mail institucional</Label>
                  <Input id="u-email" type="email" required value={form.email} onChange={set("email")} autoComplete="off" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="u-mat">Matrícula</Label>
                  <Input id="u-mat" required value={form.matricula} onChange={set("matricula")} maxLength={30} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-perfil">Perfil</Label>
                <select
                  id="u-perfil"
                  value={form.role}
                  onChange={set("role")}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {criaveis.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="u-senha">{editando ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}</Label>
                <Input
                  id="u-senha"
                  type="password"
                  autoComplete="new-password"
                  required={!editando}
                  minLength={editando && !form.password ? undefined : 10}
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!desativar} onOpenChange={(o) => !o && setDesativar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {desativar?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O acesso é encerrado na hora. O histórico do que essa pessoa fez é preservado, e o usuário pode ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => alternar.mutate(desativar)}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
