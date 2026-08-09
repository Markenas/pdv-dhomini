-- Rode isso no SQL Editor do Supabase (Project > SQL Editor > New query)

create table if not exists pdv_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security precisa estar ativo, mas como é uma ferramenta interna
-- (sem login de cliente final, só o PIN dos funcionários dentro do app),
-- liberamos leitura/escrita geral para quem tiver a chave anon do projeto.
alter table pdv_data enable row level security;

create policy "allow all - internal tool" on pdv_data
  for all
  using (true)
  with check (true);

-- Habilita realtime (atualização instantânea entre os aparelhos)
alter publication supabase_realtime add table pdv_data;
