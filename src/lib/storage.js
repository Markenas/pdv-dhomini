import { supabase } from "./supabaseClient";

export async function loadShared(key, seed) {
  const { data, error } = await supabase
    .from("pdv_data")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return seed;
  return data.value;
}

export async function saveShared(key, value) {
  const { error } = await supabase
    .from("pdv_data")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error("Erro ao salvar", key, error);
}

// Mantém todos os aparelhos sincronizados em tempo real (sem precisar recarregar a página)
export function subscribeShared(onChange) {
  const channel = supabase
    .channel("pdv_data_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "pdv_data" },
      (payload) => {
        const row = payload.new;
        if (row && row.key) onChange(row.key, row.value);
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
