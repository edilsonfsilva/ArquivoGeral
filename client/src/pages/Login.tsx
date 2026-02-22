import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login } from "@/lib/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      toast({ title: "Login realizado com sucesso", description: "Bem-vindo ao painel." });
      setLocation("/admin/painel");
    },
    onError: () => {
      toast({ title: "Credenciais inválidas", description: "E-mail ou senha incorretos.", variant: "destructive" });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-lg">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif text-slate-900">Acesso Restrito</CardTitle>
          <CardDescription className="text-base">
            Arquivo Geral do TJPE
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail institucional</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nome@tjpe.jus.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full mt-4 gap-2 text-base h-11"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              <LogIn className="h-4 w-4" /> {loginMutation.isPending ? "Entrando..." : "Entrar no Sistema"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t py-4">
          <Button variant="link" className="text-sm text-slate-500" onClick={() => setLocation("/")}>
            ← Voltar ao formulário público
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
