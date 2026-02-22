import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Initial mock users matching Admin.tsx
const initialMockUsers = [
  { id: "usr-1", name: "Admin", email: "edilson.ferreira@tjpe.jus.br", role: "admin", password: "MinhaSenha!@#" }
];

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

  useEffect(() => {
    if (!localStorage.getItem("mock_users")) {
      localStorage.setItem("mock_users", JSON.stringify(initialMockUsers));
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const storedUsers = localStorage.getItem("mock_users");
    const users = storedUsers ? JSON.parse(storedUsers) : initialMockUsers;
    
    const user = users.find((u: any) => u.email === email && u.password === password);

    if (user) {
      localStorage.setItem("adminAuth", "true");
      localStorage.setItem("adminRole", user.role);
      toast({ title: "Login realizado com sucesso", description: "Bem-vindo ao painel." });
      setLocation("/admin/painel");
    } else {
      toast({ title: "Credenciais inválidas", description: "E-mail ou senha incorretos.", variant: "destructive" });
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
