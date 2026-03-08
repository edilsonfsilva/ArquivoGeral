import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import Login from "@/pages/Login";
function Router() {
  return <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Login} />
      <Route path="/admin/painel" component={Admin} />
      <Route component={NotFound} />
    </Switch>;
}
function App() {
  return <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>;
}
var stdin_default = App;
export {
  stdin_default as default
};
