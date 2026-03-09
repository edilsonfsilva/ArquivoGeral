# TJPE Archive Assist — Guia de Deploy em Nuvem

> **Destinatário:** Equipe de Infraestrutura
> **Aplicação:** Sistema de Solicitação de Desarquivamento — Arquivo Geral TJPE
> **Stack:** Node.js 20 · PostgreSQL 16 · Nginx

---

## Sumário

1. [Pré-requisitos](#pré-requisitos)
2. [Arquivos entregues](#arquivos-entregues)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Procedimento de deploy](#procedimento-de-deploy)
5. [Configuração do Nginx / TLS](#configuração-do-nginx--tls)
6. [Verificação de saúde](#verificação-de-saúde)
7. [Backup do banco de dados](#backup-do-banco-de-dados)
8. [Atualização da aplicação](#atualização-da-aplicação)
9. [Requisitos de recursos](#requisitos-de-recursos)

---

## Pré-requisitos

| Requisito | Versão mínima |
|-----------|--------------|
| Docker Engine | 24.x |
| Docker Compose | v2.x |
| Sistema operacional | Ubuntu 22.04 LTS (recomendado) |
| Acesso de rede | Portas 80 e 443 abertas |
| Domínio | Apontando para o IP do servidor |
| Certificado TLS | Let's Encrypt ou certificado institucional |

---

## Arquivos entregues

```
deploy/
├── README.md                 ← Este documento
├── .env.example              ← Template de variáveis de ambiente
├── docker-compose.prod.yml   ← Compose de produção (app + db + nginx)
├── nginx.conf                ← Configuração do reverse proxy
├── init.sql                  ← Schema inicial do banco de dados
├── deploy.sh                 ← Script de deploy
└── backup.sh                 ← Script de backup automático
```

O `Dockerfile` está na raiz do repositório da aplicação e é usado para gerar a imagem.

---

## Variáveis de ambiente

```bash
# 1. Copie o template
cp .env.example .env

# 2. Edite com os valores reais
nano .env
```

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SESSION_SECRET` | Segredo para assinatura de cookies de sessão (min. 32 chars) | `openssl rand -hex 32` |
| `POSTGRES_DB` | Nome do banco de dados | `tjpe_archive` |
| `POSTGRES_USER` | Usuário do PostgreSQL | `tjpe` |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL | senha forte |
| `DATABASE_URL` | Gerada automaticamente pelo Compose — não precisa definir | — |
| `NODE_ENV` | Sempre `production` em produção | `production` |
| `PORT` | Porta interna da aplicação | `5000` |

> ⚠️ **Segurança:** O arquivo `.env` **nunca** deve ser versionado ou compartilhado. Utilize o cofre de segredos da organização (Vault, AWS Secrets Manager, etc.) em ambientes gerenciados.

---

## Procedimento de deploy

### Primeira instalação

```bash
# 1. Clone o repositório ou copie os artefatos para o servidor
cd /opt/tjpe

# 2. Copie os arquivos do diretório deploy/ para /opt/tjpe
cp deploy/* /opt/tjpe/

# 3. Configure as variáveis
cp .env.example .env
nano .env   # preencha SESSION_SECRET, POSTGRES_USER, POSTGRES_PASSWORD

# 4. Construa a imagem Docker (a partir da raiz do repositório)
docker build -t tjpe-archive-assist:latest .

# 5. Configure o Nginx (edite o domínio — veja seção abaixo)
nano nginx.conf

# 6. Suba os serviços
chmod +x deploy.sh
./deploy.sh
```

O banco de dados é inicializado automaticamente pelo `init.sql` na **primeira** vez que o container `db` sobe.

---

## Configuração do Nginx / TLS

### 1. Ajustar o domínio

Edite `nginx.conf` e substitua `arquivo.tjpe.jus.br` pelo domínio real:

```bash
sed -i 's/arquivo.tjpe.jus.br/SEU_DOMINIO_REAL/g' nginx.conf
```

### 2. Emitir certificado TLS (Let's Encrypt)

```bash
# Instale o certbot no servidor host (não dentro do container)
apt install certbot -y

# Emita o certificado (o Nginx deve estar parado na porta 80)
certbot certonly --standalone -d SEU_DOMINIO_REAL

# Os certificados ficam em: /etc/letsencrypt/live/SEU_DOMINIO_REAL/
```

> Caso a organização utilize CA própria (TJPE), substitua os caminhos
> `ssl_certificate` e `ssl_certificate_key` no `nginx.conf` pelos caminhos dos arquivos institucionais.

### 3. Renovação automática

```bash
# Adicione ao crontab do servidor
echo "0 3 * * * certbot renew --quiet && docker restart tjpe_nginx" | crontab -
```

---

## Verificação de saúde

```bash
# Status dos containers
docker compose -f docker-compose.prod.yml ps

# Logs da aplicação (últimas 100 linhas)
docker compose -f docker-compose.prod.yml logs app --tail=100

# Testar endpoint de saúde
curl -I https://SEU_DOMINIO_REAL/api/health
# Esperado: HTTP 200

# Verificar banco de dados
docker exec tjpe_db pg_isready -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## Backup do banco de dados

```bash
# Executar backup manual
chmod +x backup.sh
./backup.sh

# Agendar backup diário às 02:00
echo "0 2 * * * /opt/tjpe/backup.sh >> /var/log/tjpe-backup.log 2>&1" | crontab -
```

Os backups são salvos em `/opt/tjpe/backups/` no formato `tjpe_archive_YYYYMMDD_HHMMSS.sql.gz`.
Backups com mais de **30 dias** são removidos automaticamente.

### Restaurar um backup

```bash
gunzip -c /opt/tjpe/backups/tjpe_archive_YYYYMMDD.sql.gz \
  | docker exec -i tjpe_db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## Atualização da aplicação

```bash
# 1. Gere a nova imagem (no ambiente de CI/CD ou localmente)
docker build -t tjpe-archive-assist:latest .

# 2. Execute o deploy com pull da nova imagem
./deploy.sh --pull
```

O Compose recria apenas o container `app`; o banco e o Nginx permanecem intactos.

---

## Requisitos de recursos

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| vCPU | 1 | 2 |
| RAM | 512 MB | 1 GB |
| Disco | 10 GB | 20 GB |
| Banco de dados | PostgreSQL 16 (container) | PostgreSQL gerenciado (RDS/Cloud SQL) |

> Para ambientes de alta disponibilidade, considere separar o PostgreSQL em um
> serviço gerenciado (ex.: Amazon RDS, Azure Database for PostgreSQL) e remover
> o serviço `db` do Compose, apontando `DATABASE_URL` para o host externo.

---

## Portas e comunicação interna

```
Internet
  │
  ▼ 80/443
┌─────────────────┐
│     Nginx       │  (tjpe_nginx)
└────────┬────────┘
         │ http://app:5000
         ▼
┌─────────────────┐
│  Node.js App    │  (tjpe_app — porta 5000 interna apenas)
└────────┬────────┘
         │ postgresql://db:5432
         ▼
┌─────────────────┐
│   PostgreSQL    │  (tjpe_db — porta 5432 interna apenas)
└─────────────────┘
```

A porta do banco **não é exposta** para fora da rede Docker em produção.

---

## Suporte

Em caso de dúvidas sobre a aplicação, contatar a equipe de desenvolvimento responsável pelo projeto TJPE Archive Assist.
