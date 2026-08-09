# PDV Dhomini Café

## 1. Supabase
1. Crie um projeto em https://supabase.com (grátis).
2. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase_schema.sql` e rode.
3. Vá em **Project Settings > API** e copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`

## 2. Rodar local (opcional, pra testar antes)
```bash
cp .env.example .env
# cole a URL e a chave anon no .env
npm install
npm run dev
```

## 3. Deploy no Netlify
**Opção A — via Git (recomendado):**
1. Suba essa pasta num repositório (GitHub/GitLab).
2. No Netlify: **Add new site > Import an existing project**, conecte o repositório.
3. O `netlify.toml` já define build (`npm run build`) e pasta de publicação (`dist`).
4. Em **Site settings > Environment variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
5. Deploy.

**Opção B — arrastar e soltar:**
1. Rode `npm run build` localmente (gera a pasta `dist`).
2. Arraste a pasta `dist` em https://app.netlify.com/drop.
3. Nesse método as variáveis de ambiente precisam estar no `.env` antes do build, já que o Netlify não vai rodar `npm install`/build por você.

## Observações
- O número do ticket reseta todo dia (conta só as comandas abertas na data atual).
- A política do Supabase está aberta (qualquer um com a chave anon lê/escreve) — ok para uma ferramenta interna pequena, mas não exponha a chave publicamente além do necessário.
- PIN de funcionário é identificação simples, não é criptografia de nível bancário.
