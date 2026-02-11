import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, FileText, Scale, Info, AlertCircle } from "lucide-react";

import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  // Solicitante
  cpf: z.string().min(11, "CPF inválido").max(14, "CPF inválido"),
  nomeCompleto: z.string().min(3, "Nome completo é obrigatório"),
  whatsapp: z.string().min(10, "Número de WhatsApp inválido"),
  email: z.string().email("E-mail inválido"),
  oab: z.string().optional(),
  
  // Processo
  tipoNumeracao: z.enum(["npu", "tombo"], {
    required_error: "Selecione o tipo de numeração",
  }),
  numeroProcesso: z.string().min(1, "Número do processo é obrigatório"),
  partes: z.string().min(3, "Informe as partes do processo"),
  segredoJustica: z.enum(["sim", "nao"], {
    required_error: "Informe se há segredo de justiça",
  }),
  observacao: z.string().optional(),
});

export default function Home() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cpf: "",
      nomeCompleto: "",
      whatsapp: "",
      email: "",
      oab: "",
      numeroProcesso: "",
      partes: "",
      observacao: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // Simulate API delay
    setTimeout(() => {
      setIsSubmitted(true);
      toast({
        title: "Solicitação Enviada",
        description: "Seu pedido foi registrado com sucesso. Verifique seu e-mail.",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1000);
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <Card className="border-t-4 border-t-green-600 shadow-lg">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl font-serif text-green-800">Solicitação Recebida</CardTitle>
                <CardDescription>
                  Seu pedido de desarquivamento foi enviado para nossa equipe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600 space-y-2 border">
                  <p><strong>Protocolo:</strong> #{Math.floor(Math.random() * 1000000)}</p>
                  <p>Uma confirmação foi enviada para o e-mail cadastrado. O prazo médio de resposta é de 48 horas úteis.</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={() => {
                    setIsSubmitted(false);
                    form.reset();
                  }}
                >
                  Nova Solicitação
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900">
              Solicitação de Atendimento
            </h1>
            <p className="text-slate-600 text-lg">
              Preencha o formulário abaixo para solicitar desarquivamento ou consulta de processos.
            </p>
          </div>

          <Card className="border-t-4 border-t-primary shadow-lg overflow-hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* Section 1: Requester Data */}
                <div className="p-6 md:p-8 space-y-6">
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-serif font-semibold text-slate-800">
                      Dados do Solicitante
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="nomeCompleto"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite seu nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF</FormLabel>
                          <FormControl>
                            <Input placeholder="000.000.000-00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="whatsapp"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp</FormLabel>
                          <FormControl>
                            <Input placeholder="(00) 00000-0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input placeholder="seu@email.com" type="email" {...field} />
                          </FormControl>
                          <FormDescription>
                            Para onde enviaremos as atualizações do pedido.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="oab"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nº OAB <span className="text-muted-foreground font-normal">(Opcional)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: 12345-PE" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Mock File Upload */}
                    <div className="col-span-1 md:col-span-2 space-y-3">
                      <FormLabel>Procuração de Habilitação</FormLabel>
                      <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                        <div className="bg-slate-100 p-3 rounded-full mb-3 group-hover:bg-slate-200 transition-colors">
                          <Upload className="h-6 w-6 text-slate-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-700">Clique para fazer upload do arquivo</p>
                        <p className="text-xs text-slate-500 mt-1">PDF, PNG ou JPG (Máx. 5MB)</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Section 2: Process Data */}
                <div className="p-6 md:p-8 space-y-6 bg-slate-50/50">
                  <div className="flex items-center gap-3 pb-2 border-b">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Scale className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-xl font-serif font-semibold text-slate-800">
                      Dados do Processo
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="tipoNumeracao"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Tipo de Numeração</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="npu" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  NPU (Numeração Única)
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="tombo" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Número Antigo / Tombo
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="segredoJustica"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Segredo de Justiça?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="sim" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Sim
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="nao" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Não
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="numeroProcesso"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>Número do Processo</FormLabel>
                          <FormControl>
                            <Input placeholder="0000000-00.0000.8.17.0000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="partes"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>Partes (Autor / Réu)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: João da Silva vs. Empresa X" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="observacao"
                      render={({ field }) => (
                        <FormItem className="col-span-1 md:col-span-2">
                          <FormLabel>Observações Adicionais</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Alguma informação extra que ajude na localização..." 
                              className="resize-none min-h-[100px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="p-6 md:p-8 pt-0 flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 max-w-md">
                    <Info className="h-4 w-4 shrink-0" />
                    <p>Verifique se todos os dados estão corretos antes de enviar.</p>
                  </div>
                  <Button type="submit" size="lg" className="w-full md:w-auto px-8">
                    Enviar Solicitação
                  </Button>
                </div>

              </form>
            </Form>
          </Card>
        </div>
      </main>

      <footer className="py-6 bg-slate-900 text-slate-400 text-center text-sm">
        <div className="container mx-auto px-4">
          <p>© {new Date().getFullYear()} Tribunal de Justiça de Pernambuco - Arquivo Geral</p>
          <p className="text-xs mt-1 text-slate-600">Desenvolvido para fins de demonstração</p>
        </div>
      </footer>
    </div>
  );
}
