# Testes de ponta a ponta (API)

Rodam contra um servidor em execução (local ou publicado). As contas ficam num arquivo JSON fora do repositório.

```bash
# 1. Cria uma conta de demonstração por perfil (idempotente). gerente.json: {"ADMIN_EMAIL": "...", "ADMIN_PASSWORD": "..."}
node tests/e2e/demo-setup.cjs https://servidor gerente.json contas.json

# 2. Fluxo completo, permissões e concorrência (81 verificações; apaga os pedidos de teste no final)
node tests/e2e/fluxo.cjs https://servidor contas.json

# 3. Regressão da auditoria de segurança (31 verificações)
node tests/e2e/smoke.cjs https://servidor contas.json

# 4. (Opcional) Carrega pedidos fictícios em várias etapas, para demonstração
node tests/e2e/demo-dados.cjs https://servidor contas.json
```

Em `http://localhost` os scripts enviam `X-Forwarded-Proto: https` para o cookie de sessão (Secure) funcionar sem proxy.
Testes unitários das regras do fluxo: `npm test`.
