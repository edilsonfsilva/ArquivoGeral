import { Link } from "wouter";
function Header() {
  return <>
    <div role="note" className="w-full bg-amber-100 border-b border-amber-300 text-amber-950 text-center text-xs sm:text-sm font-medium px-4 py-1.5 print:hidden">
      Protótipo para validação do fluxo de desarquivamento — não envie dados reais. Não é um canal oficial do TJPE.
    </div>
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
  </>;
}
export {
  Header
};
