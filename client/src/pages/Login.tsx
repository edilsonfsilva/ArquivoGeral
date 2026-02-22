import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Mock authentication logic
export const checkAuth = () => {
  return localStorage.getItem("adminAuth") === "true";
};

export const logout = () => {
  localStorage.removeItem("adminAuth");
  localStorage.removeItem("adminRole");
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple mock validation
    if (email === "admin@tjpe.jus.br" && password === "admin123") {
      localStorage.setItem("adminAuth", "true");
      localStorage.setItem("adminRole", "admin");
      toast({ title: "Login realizado com sucesso", description: "Bem-vindo ao painel." });
      setLocation("/admin/painel");
    } else if (email === "atendente@tjpe.jus.br" && password === "atendente123") {
      localStorage.setItem("adminAuth", "true");
      localStorage.setItem("adminRole", "atendente");
      toast({ title: "Login realizado com sucesso", description: "Bem-vindo ao painel." });
      setLocation("/admin/painel");
    } else {
      toast({ title: "Credenciais inválidas", description: "Tente admin@tjpe.jus.br / admin123", variant: "destructive" });
    }
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
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm flex gap-3 items-start mt-6">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Credenciais de teste (Protótipo):</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  <li><strong>Admin:</strong> admin@tjpe.jus.br / admin123</li>
                  <li><strong>Atendente:</strong> atendente@tjpe.jus.br / atendente123</li>
                </ul>
              </div>
            </div>

            <Button type="submit" className="w-full mt-4 gap-2 text-base h-11">
              <LogIn className="h-4 w-4" /> Entrar no Sistema
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
