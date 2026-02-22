import { Link } from "wouter";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img 
              src="/logo.png" 
              alt="Brasão TJPE" 
              className="h-10 object-contain"
            />
            <div className="flex flex-col">
              <span className="font-serif font-bold text-primary text-lg leading-tight">
                Arquivo Geral
              </span>
              <span className="text-xs text-muted-foreground tracking-wider font-medium">
                TRIBUNAL DE JUSTIÇA DE PERNAMBUCO
              </span>
            </div>
        </Link>
      </div>
    </header>
  );
}
