import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Atendimento from "@/pages/Atendimento";
import Busca from "@/pages/Busca";
import Gerencia from "@/pages/Gerencia";
import Consulta from "@/pages/Consulta";
import Verificar from "@/pages/Verificar";
import Certidao from "@/pages/Certidao";
import { useUsuario } from "@/lib/painel";

// Endereço antigo do painel: leva cada perfil para a tela do seu setor.
function PainelAntigo() {
  const [, setLocation] = useLocation();
  const { data } = useUsuario();
  useEffect(() => {
    if (data) setLocation(data.tela);
  }, [data, setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/consulta" component={Consulta} />
      <Route path="/verificar/:codigo?" component={Verificar} />
      <Route path="/admin" component={Login} />
      <Route path="/admin/painel" component={PainelAntigo} />
      <Route path="/atendimento" component={Atendimento} />
      <Route path="/busca" component={Busca} />
      <Route path="/gerencia" component={Gerencia} />
      <Route path="/certidao/:id" component={Certidao} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
