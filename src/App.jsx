import React, { useState, useEffect, useMemo } from "react";
import { Coffee, Package, Receipt, Plus, Minus, Trash2, AlertTriangle, X, Users, LogOut, Search, Clock } from "lucide-react";
import { loadShared, saveShared, subscribeShared } from "./lib/storage";

const FONT_LINK_ID = "pdv-cafeteria-fonts";

function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtBRL = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SEED_PRODUTOS = [
  { id: "p1", name: "Espresso", category: "Bebida quente", price: 6, cost: 1.5 },
  { id: "p2", name: "Cappuccino", category: "Bebida quente", price: 9, cost: 2.8 },
  { id: "p3", name: "Café com Leite", category: "Bebida quente", price: 7, cost: 2 },
  { id: "p4", name: "Latte", category: "Bebida quente", price: 10, cost: 3 },
  { id: "p5", name: "Suco Natural", category: "Bebida fria", price: 8, cost: 3 },
  { id: "p6", name: "Pão de Queijo", category: "Salgado", price: 6, cost: 2 },
  { id: "p7", name: "Bolo do Dia (fatia)", category: "Doce", price: 9, cost: 3 },
  { id: "p8", name: "Croissant", category: "Doce", price: 11, cost: 4 },
];

const SEED_INSUMOS = [
  { id: "i1", name: "Café em grão", unit: "kg", qty: 5, minQty: 1 },
  { id: "i2", name: "Leite", unit: "L", qty: 10, minQty: 3 },
  { id: "i3", name: "Copos descartáveis", unit: "un", qty: 200, minQty: 50 },
  { id: "i4", name: "Açúcar", unit: "kg", qty: 4, minQty: 1 },
  { id: "i5", name: "Pão de Queijo (congelado)", unit: "un", qty: 60, minQty: 20 },
];

const PAY_METHODS = ["Dinheiro", "Cartão", "Pix"];

const KEYS = {
  produtos: "cafeteria-produtos",
  insumos: "cafeteria-insumos",
  comandas: "cafeteria-comandas",
  funcionarios: "cafeteria-funcionarios",
};

export default function PDVCafeteria() {
  useEffect(() => {
    ensureFonts();
  }, []);

  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("comandas");
  const [produtos, setProdutos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [caixaFiltro, setCaixaFiltro] = useState("hoje");
  const [printData, setPrintData] = useState(null);

  useEffect(() => {
    if (!printData) return;
    const t = setTimeout(() => window.print(), 80);
    const onAfter = () => setPrintData(null);
    window.addEventListener("afterprint", onAfter);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", onAfter); };
  }, [printData]);

  useEffect(() => {
    (async () => {
      const [p, i, c, f] = await Promise.all([
        loadShared(KEYS.produtos, SEED_PRODUTOS),
        loadShared(KEYS.insumos, SEED_INSUMOS),
        loadShared(KEYS.comandas, []),
        loadShared(KEYS.funcionarios, []),
      ]);
      setProdutos(p);
      setInsumos(i);
      setComandas(c);
      setFuncionarios(f);
      setReady(true);
    })();
  }, []);

  // Mantém os 3 aparelhos sincronizados em tempo real
  useEffect(() => {
    const setterByKey = {
      [KEYS.produtos]: setProdutos,
      [KEYS.insumos]: setInsumos,
      [KEYS.comandas]: setComandas,
      [KEYS.funcionarios]: setFuncionarios,
    };
    const unsubscribe = subscribeShared((key, value) => {
      const setter = setterByKey[key];
      if (setter) setter(value);
    });
    return unsubscribe;
  }, []);

  const persistProdutos = (next) => { setProdutos(next); saveShared(KEYS.produtos, next); };
  const persistInsumos = (next) => { setInsumos(next); saveShared(KEYS.insumos, next); };
  const persistComandas = (next) => { setComandas(next); saveShared(KEYS.comandas, next); };
  const persistFuncionarios = (next) => { setFuncionarios(next); saveShared(KEYS.funcionarios, next); };

  const lowStock = insumos.filter((i) => i.qty <= i.minQty);
  const comandasAbertas = comandas.filter((c) => c.status === "aberta");

  const vendasFiltradas = useMemo(() => {
    const pagas = comandas.filter((c) => c.status === "paga");
    if (caixaFiltro === "todos") return pagas;
    const hoje = todayStr();
    return pagas.filter((c) => c.dateStr === hoje);
  }, [comandas, caixaFiltro]);

  if (!ready) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }} className="min-h-screen flex items-center justify-center bg-stone-900 text-amber-50">
        Carregando caixa...
      </div>
    );
  }

  if (!currentEmployee) {
    return (
      <LoginScreen
        funcionarios={funcionarios}
        setFuncionarios={persistFuncionarios}
        onLogin={setCurrentEmployee}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#231912", fontFamily: "Inter, sans-serif" }}>
      <style>{`
        .pdv-serif { font-family: 'Fraunces', serif; }
        .pdv-mono { font-family: 'IBM Plex Mono', monospace; }
        .pdv-card { background: #2F241A; border: 1px solid #4A3B2A; }
        .pdv-tab-active { background: #C99A4A; color: #231912; }
        .pdv-tab { color: #C9B79C; }
        .pdv-scroll::-webkit-scrollbar { width: 6px; }
        .pdv-scroll::-webkit-scrollbar-thumb { background: #4A3B2A; border-radius: 4px; }
        @keyframes pdvFloatUp { 0% { opacity: 0; transform: translateY(4px) scale(0.8); } 30% { opacity: 1; transform: translateY(-2px) scale(1.1); } 100% { opacity: 0; transform: translateY(-16px) scale(1); } }
        .pdv-receipt-print { display: none; }
        @media print {
          @page { size: 80mm auto; margin: 0; }
          body * { visibility: hidden; }
          .pdv-receipt-print, .pdv-receipt-print * { visibility: visible; }
          .pdv-receipt-print {
            display: block !important;
            position: absolute; top: 0; left: 0; width: 76mm;
            padding: 4mm; font-family: 'IBM Plex Mono', monospace; color: #000; background: #fff;
          }
        }
      `}</style>

      <ReceiptPrint data={printData} />

      <header className="px-4 sm:px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "#4A3B2A" }}>
        <div className="flex items-center gap-2">
          <Coffee size={22} color="#C99A4A" />
          <h1 className="pdv-serif text-xl sm:text-2xl" style={{ color: "#F2E9DA" }}>Dhomini Café · PDV</h1>
        </div>
        <div className="flex items-center gap-3">
          {lowStock.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: "#3A2A1F", color: "#E0A36E" }}>
              <AlertTriangle size={14} />
              {lowStock.length} insumo(s) em baixa
            </div>
          )}
          <div className="flex items-center gap-2 text-sm" style={{ color: "#F2E9DA" }}>
            <span className="pdv-mono">{currentEmployee.name}</span>
            <button onClick={() => setCurrentEmployee(null)} title="Trocar usuário">
              <LogOut size={16} color="#C9B79C" />
            </button>
          </div>
        </div>
      </header>

      <nav className="flex gap-1 px-4 sm:px-6 pt-3 overflow-x-auto pdv-scroll">
        {[
          { id: "comandas", label: "Comandas", icon: Receipt },
          { id: "produtos", label: "Produtos", icon: Coffee },
          { id: "estoque", label: "Estoque", icon: Package },
          ...(currentEmployee.role === "dono" ? [{ id: "caixa", label: "Caixa", icon: Receipt }] : []),
          { id: "equipe", label: "Equipe", icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap ${active ? "pdv-tab-active" : "pdv-tab"}`}>
              <Icon size={15} />{t.label}
              {t.id === "comandas" && comandasAbertas.length > 0 && (
                <span className="pdv-mono text-xs px-1.5 rounded-full" style={{ background: active ? "#231912" : "#C99A4A", color: active ? "#C99A4A" : "#231912" }}>
                  {comandasAbertas.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <main className="p-4 sm:p-6" style={{ borderTop: "1px solid #4A3B2A" }}>
        {tab === "comandas" && (
          <ComandasTab
            produtos={produtos}
            comandas={comandas}
            setComandas={persistComandas}
            currentEmployee={currentEmployee}
            onPrint={setPrintData}
          />
        )}
        {tab === "produtos" && <ProdutosTab produtos={produtos} setProdutos={persistProdutos} />}
        {tab === "estoque" && <EstoqueTab insumos={insumos} setInsumos={persistInsumos} />}
        {tab === "caixa" && currentEmployee.role === "dono" && (
          <CaixaTab vendas={vendasFiltradas} filtro={caixaFiltro} setFiltro={setCaixaFiltro} comandas={comandas} setComandas={persistComandas} />
        )}
        {tab === "equipe" && (
          <EquipeTab funcionarios={funcionarios} setFuncionarios={persistFuncionarios} currentEmployee={currentEmployee} />
        )}
      </main>
    </div>
  );
}

/* ---------------- LOGIN ---------------- */

function LoginScreen({ funcionarios, setFuncionarios, onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");

  useEffect(() => { ensureFonts(); }, []);

  const tryLogin = () => {
    const f = funcionarios.find((x) => x.id === selected);
    if (!f) return;
    if (pin === f.pin) {
      onLogin({ id: f.id, name: f.name, role: f.role || "funcionario" });
    } else {
      setError("PIN incorreto.");
      setPin("");
    }
  };

  const createFirst = () => {
    if (!setupName || setupPin.length !== 4) return;
    const novo = { id: genId(), name: setupName, pin: setupPin, role: "dono" };
    setFuncionarios([novo]);
    onLogin({ id: novo.id, name: novo.name, role: "dono" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#231912", fontFamily: "Inter, sans-serif" }}>
      <style>{`.pdv-serif { font-family: 'Fraunces', serif; } .pdv-mono { font-family: 'IBM Plex Mono', monospace; }`}</style>
      <div className="pdv-card rounded-xl p-6 w-full max-w-sm" style={{ background: "#2F241A", border: "1px solid #4A3B2A" }}>
        <div className="flex items-center gap-2 mb-5 justify-center">
          <Coffee size={22} color="#C99A4A" />
          <h1 className="pdv-serif text-xl" style={{ color: "#F2E9DA" }}>Dhomini Café</h1>
        </div>

        {funcionarios.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "#C9B79C" }}>Nenhum funcionário cadastrado ainda. Crie o primeiro acesso — ele será o acesso do <strong>dono</strong>, com visão do Caixa:</p>
            <input placeholder="Nome" value={setupName} onChange={(e) => setSetupName(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm" style={{ background: "#231912", border: "1px solid #4A3B2A", color: "#F2E9DA" }} />
            <input placeholder="PIN de 4 dígitos" value={setupPin} maxLength={4}
              onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, ""))}
              className="w-full px-3 py-2 rounded text-sm pdv-mono" style={{ background: "#231912", border: "1px solid #4A3B2A", color: "#F2E9DA" }} />
            <button onClick={createFirst} className="w-full py-2 rounded font-semibold" style={{ background: "#C99A4A", color: "#231912" }}>
              Criar acesso e entrar
            </button>
          </div>
        ) : !selected ? (
          <div className="space-y-2">
            <p className="text-sm mb-2" style={{ color: "#C9B79C" }}>Quem é você?</p>
            {funcionarios.map((f) => (
              <button key={f.id} onClick={() => { setSelected(f.id); setError(""); }}
                className="w-full text-left px-3 py-2 rounded text-sm" style={{ background: "#3A2A1F", color: "#F2E9DA" }}>
                {f.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "#C9B79C" }}>
              PIN de {funcionarios.find((f) => f.id === selected)?.name}
            </p>
            <input
              type="password" value={pin} maxLength={4} autoFocus
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && tryLogin()}
              className="w-full px-3 py-2 rounded text-center text-lg tracking-widest pdv-mono"
              style={{ background: "#231912", border: "1px solid #4A3B2A", color: "#F2E9DA" }}
            />
            {error && <p className="text-xs" style={{ color: "#C1553D" }}>{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
                className="flex-1 py-2 rounded text-sm" style={{ background: "#3A2A1F", color: "#C9B79C" }}>Voltar</button>
              <button onClick={tryLogin} className="flex-1 py-2 rounded font-semibold" style={{ background: "#C99A4A", color: "#231912" }}>Entrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- COMANDAS ---------------- */

function ComandasTab({ produtos, comandas, setComandas, currentEmployee, onPrint }) {
  const [mode, setMode] = useState("lista"); // lista | nova | editar | pagar
  const [activeId, setActiveId] = useState(null);
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState("");
  const [buscaTicket, setBuscaTicket] = useState("");
  const [buscaErro, setBuscaErro] = useState("");
  const [flashId, setFlashId] = useState(null);

  const abertas = comandas.filter((c) => c.status === "aberta").sort((a, b) => a.ticketNumber - b.ticketNumber);

  const categorias = useMemo(() => {
    const cats = [];
    produtos.forEach((p) => { if (!cats.includes(p.category)) cats.push(p.category); });
    return cats;
  }, [produtos]);

  const nextTicketNumber = () => {
    const hoje = todayStr();
    const todays = comandas.filter((c) => c.dateStr === hoje);
    return todays.length ? Math.max(...todays.map((c) => c.ticketNumber)) + 1 : 1;
  };

  const startNova = () => { setCart([]); setClientName(""); setMode("nova"); setActiveId(null); };

  const startEditar = (comanda) => { setActiveId(comanda.id); setCart(comanda.items); setMode("editar"); };

  const startPagar = (comanda) => { setActiveId(comanda.id); setMode("pagar"); };

  const buscarPorNumero = () => {
    const num = parseInt(buscaTicket, 10);
    const c = abertas.find((x) => x.ticketNumber === num);
    if (!c) { setBuscaErro("Nenhuma comanda aberta com esse número."); return; }
    setBuscaErro("");
    startPagar(c);
  };

  const addToCart = (produto) => {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.productId === produto.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { productId: produto.id, name: produto.name, price: produto.price, cost: produto.cost, qty: 1 }];
    });
    setFlashId(produto.id);
    window.clearTimeout(window.__pdvFlashTimeout);
    window.__pdvFlashTimeout = window.setTimeout(() => setFlashId(null), 450);
  };
  const changeQty = (idx, delta) => {
    setCart((prev) => {
      const next = [...prev];
      const item = { ...next[idx], qty: next[idx].qty + delta };
      if (item.qty <= 0) { next.splice(idx, 1); return next; }
      next[idx] = item;
      return next;
    });
  };
  const removeItem = (idx) => setCart((prev) => prev.filter((_, i) => i !== idx));
  const cartTotal = useMemo(() => cart.reduce((s, it) => s + it.price * it.qty, 0), [cart]);

  const salvarNova = () => {
    if (cart.length === 0) return;
    const comanda = {
      id: genId(),
      ticketNumber: nextTicketNumber(),
      dateStr: todayStr(),
      clientName: clientName || null,
      items: cart,
      status: "aberta",
      openedBy: currentEmployee.name,
      openedAt: new Date().toISOString(),
      closedBy: null, closedAt: null, paymentMethod: null,
    };
    setComandas([comanda, ...comandas]);
    setMode("lista");
    onPrint({ type: "ticket", comanda, timestamp: comanda.openedAt });
  };

  const salvarEdicao = () => {
    setComandas(comandas.map((c) => (c.id === activeId ? { ...c, items: cart } : c)));
    setMode("lista");
  };

  const [payMethod, setPayMethod] = useState("Dinheiro");
  const confirmarPagamento = () => {
    const comanda = comandas.find((c) => c.id === activeId);
    if (!comanda) return;
    const total = comanda.items.reduce((s, it) => s + it.price * it.qty, 0);
    const totalCost = comanda.items.reduce((s, it) => s + it.cost * it.qty, 0);
    const closedAt = new Date().toISOString();
    const comandaFechada = {
      ...comanda, status: "paga", closedBy: currentEmployee.name, closedAt,
      paymentMethod: payMethod, total, totalCost, profit: total - totalCost,
    };
    setComandas(comandas.map((c) => c.id === activeId ? comandaFechada : c));
    setMode("lista");
    setPayMethod("Dinheiro");
    setBuscaTicket("");
    onPrint({ type: "comprovante", comanda: comandaFechada, timestamp: closedAt });
  };

  const cancelarComanda = (id) => {
    setComandas(comandas.filter((c) => c.id !== id));
    setMode("lista");
  };

  if (mode === "nova" || mode === "editar") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-5">
          {mode === "nova" && (
            <input placeholder="Nome do cliente (opcional)" value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm mb-2" style={{ background: "#2F241A", border: "1px solid #4A3B2A", color: "#F2E9DA" }} />
          )}
          {categorias.map((cat) => (
            <div key={cat}>
              <h3 className="pdv-serif text-sm uppercase tracking-wide mb-2" style={{ color: "#C99A4A" }}>{cat}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {produtos.filter((p) => p.category === cat).map((p) => {
                  const flashing = flashId === p.id;
                  return (
                    <button key={p.id} onClick={() => addToCart(p)}
                      className="pdv-card rounded-lg p-3 text-left hover:brightness-110 transition relative overflow-hidden"
                      style={{
                        transform: flashing ? "scale(0.94)" : "scale(1)",
                        borderColor: flashing ? "#7C8A5C" : "#4A3B2A",
                        boxShadow: flashing ? "0 0 0 2px #7C8A5C" : "none",
                        transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
                      }}>
                      <div className="text-sm font-medium" style={{ color: "#F2E9DA" }}>{p.name}</div>
                      <div className="pdv-mono text-sm mt-1" style={{ color: "#C99A4A" }}>{fmtBRL(p.price)}</div>
                      {flashing && (
                        <span className="pdv-serif" style={{
                          position: "absolute", top: 4, right: 6, color: "#7C8A5C",
                          fontSize: "13px", fontWeight: 700, animation: "pdvFloatUp 450ms ease-out forwards",
                        }}>
                          +1
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="pdv-card rounded-lg p-4 flex flex-col" style={{ minHeight: "420px" }}>
          <h3 className="pdv-serif text-lg mb-3" style={{ color: "#F2E9DA" }}>
            {mode === "nova" ? "Nova comanda" : "Adicionar itens"}
          </h3>
          <div className="flex-1 overflow-y-auto pdv-scroll space-y-2" style={{ maxHeight: "320px" }}>
            {cart.length === 0 && <p className="text-sm" style={{ color: "#8A7863" }}>Toque em um produto para adicionar.</p>}
            {cart.map((it, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm" style={{ color: "#F2E9DA" }}>
                <span className="flex-1 truncate">{it.name}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeQty(idx, -1)} className="p-1 rounded" style={{ background: "#3A2A1F" }}><Minus size={12} color="#F2E9DA" /></button>
                  <span className="w-5 text-center pdv-mono">{it.qty}</span>
                  <button onClick={() => changeQty(idx, 1)} className="p-1 rounded" style={{ background: "#3A2A1F" }}><Plus size={12} color="#F2E9DA" /></button>
                  <span className="w-16 text-right pdv-mono">{fmtBRL(it.price * it.qty)}</span>
                  <button onClick={() => removeItem(idx)}><X size={12} color="#C1553D" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t mt-3 pt-3" style={{ borderColor: "#4A3B2A", borderStyle: "dashed" }}>
            <div className="flex justify-between pdv-mono text-lg font-semibold" style={{ color: "#F2E9DA" }}>
              <span>Total</span><span>{fmtBRL(cartTotal)}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setMode("lista")} className="flex-1 py-2 rounded text-sm" style={{ background: "#3A2A1F", color: "#C9B79C" }}>Cancelar</button>
              <button onClick={mode === "nova" ? salvarNova : salvarEdicao} disabled={cart.length === 0}
                className="flex-1 py-2 rounded-lg font-semibold pdv-serif disabled:opacity-40" style={{ background: "#7C8A5C", color: "#1D2314" }}>
                {mode === "nova" ? "Abrir Comanda" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "pagar") {
    const comanda = comandas.find((c) => c.id === activeId);
    if (!comanda) { setMode("lista"); return null; }
    const total = comanda.items.reduce((s, it) => s + it.price * it.qty, 0);
    return (
      <div className="max-w-md mx-auto pdv-card rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="pdv-serif text-lg" style={{ color: "#F2E9DA" }}>Ticket #{comanda.ticketNumber}</h3>
          <span className="text-xs" style={{ color: "#C9B79C" }}>{comanda.clientName || "sem nome"}</span>
        </div>
        <div className="space-y-1 mb-3">
          {comanda.items.map((it, i) => (
            <div key={i} className="flex justify-between text-sm" style={{ color: "#F2E9DA" }}>
              <span>{it.qty}x {it.name}</span>
              <span className="pdv-mono">{fmtBRL(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between pdv-mono text-xl font-semibold border-t pt-2" style={{ borderColor: "#4A3B2A", color: "#F2E9DA" }}>
          <span>Total</span><span>{fmtBRL(total)}</span>
        </div>
        <div className="flex gap-2 mt-4">
          {PAY_METHODS.map((m) => (
            <button key={m} onClick={() => setPayMethod(m)} className="flex-1 text-xs py-1.5 rounded"
              style={{ background: payMethod === m ? "#C99A4A" : "#3A2A1F", color: payMethod === m ? "#231912" : "#C9B79C" }}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => setMode("lista")} className="flex-1 py-2 rounded text-sm" style={{ background: "#3A2A1F", color: "#C9B79C" }}>Voltar</button>
          <button onClick={confirmarPagamento} className="flex-1 py-2 rounded-lg font-semibold pdv-serif" style={{ background: "#7C8A5C", color: "#1D2314" }}>
            Confirmar Pagamento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <button onClick={startNova} className="px-4 py-2 rounded-lg font-semibold pdv-serif w-full sm:w-auto" style={{ background: "#C99A4A", color: "#231912" }}>
          + Nova Comanda
        </button>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 pdv-card rounded px-2">
            <Search size={14} color="#C9B79C" />
            <input placeholder="Nº do ticket" value={buscaTicket}
              onChange={(e) => { setBuscaTicket(e.target.value.replace(/\D/g, "")); setBuscaErro(""); }}
              onKeyDown={(e) => e.key === "Enter" && buscarPorNumero()}
              className="bg-transparent px-2 py-2 text-sm pdv-mono w-24" style={{ color: "#F2E9DA" }} />
          </div>
          <button onClick={buscarPorNumero} className="px-3 py-2 rounded text-sm" style={{ background: "#3A2A1F", color: "#F2E9DA" }}>Pagar</button>
        </div>
      </div>
      {buscaErro && <p className="text-xs" style={{ color: "#C1553D" }}>{buscaErro}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {abertas.map((c) => {
          const total = c.items.reduce((s, it) => s + it.price * it.qty, 0);
          const mins = Math.max(0, Math.round((Date.now() - new Date(c.openedAt).getTime()) / 60000));
          return (
            <div key={c.id} className="pdv-card rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="pdv-serif text-2xl" style={{ color: "#C99A4A" }}>#{c.ticketNumber}</div>
                  <div className="text-xs" style={{ color: "#C9B79C" }}>{c.clientName || "Sem nome"} · aberto por {c.openedBy}</div>
                </div>
                <button onClick={() => cancelarComanda(c.id)} title="Cancelar comanda"><Trash2 size={14} color="#C1553D" /></button>
              </div>
              <div className="text-xs mt-2 flex items-center gap-1" style={{ color: "#8A7863" }}>
                <Clock size={11} /> há {mins} min · {c.items.reduce((s, it) => s + it.qty, 0)} itens
              </div>
              <div className="pdv-mono text-lg mt-1" style={{ color: "#F2E9DA" }}>{fmtBRL(total)}</div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => startEditar(c)} className="flex-1 py-1.5 rounded text-xs" style={{ background: "#3A2A1F", color: "#C9B79C" }}>+ Itens</button>
                <button onClick={() => onPrint({ type: "ticket", comanda: c, timestamp: c.openedAt })} className="py-1.5 px-2 rounded text-xs" style={{ background: "#3A2A1F", color: "#C9B79C" }} title="Reimprimir senha">🖨</button>
                <button onClick={() => startPagar(c)} className="flex-1 py-1.5 rounded text-xs font-semibold" style={{ background: "#7C8A5C", color: "#1D2314" }}>Pagar</button>
              </div>
            </div>
          );
        })}
        {abertas.length === 0 && (
          <p className="text-sm col-span-full" style={{ color: "#8A7863" }}>Nenhuma comanda aberta no momento.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- PRODUTOS ---------------- */

function ProdutosTab({ produtos, setProdutos }) {
  const [form, setForm] = useState({ name: "", category: "", price: "", cost: "" });
  const add = () => {
    if (!form.name || !form.price) return;
    setProdutos([...produtos, { id: genId(), name: form.name, category: form.category || "Outros", price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0 }]);
    setForm({ name: "", category: "", price: "", cost: "" });
  };
  const remove = (id) => setProdutos(produtos.filter((p) => p.id !== id));
  return (
    <div className="space-y-4">
      <div className="pdv-card rounded-lg p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <Field label="Produto" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
        <Field label="Preço" value={form.price} onChange={(v) => setForm({ ...form, price: v })} numeric />
        <Field label="Custo" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} numeric />
        <button onClick={add} className="py-2 rounded font-medium" style={{ background: "#C99A4A", color: "#231912" }}>Adicionar</button>
      </div>
      <div className="pdv-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr style={{ color: "#C99A4A" }} className="text-left">
            <th className="p-3">Produto</th><th className="p-3">Categoria</th><th className="p-3">Preço</th><th className="p-3">Custo</th><th className="p-3">Margem</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #4A3B2A", color: "#F2E9DA" }}>
                <td className="p-3">{p.name}</td>
                <td className="p-3" style={{ color: "#C9B79C" }}>{p.category}</td>
                <td className="p-3 pdv-mono">{fmtBRL(p.price)}</td>
                <td className="p-3 pdv-mono">{fmtBRL(p.cost)}</td>
                <td className="p-3 pdv-mono" style={{ color: "#7C8A5C" }}>{fmtBRL(p.price - p.cost)}</td>
                <td className="p-3"><button onClick={() => remove(p.id)}><Trash2 size={14} color="#C1553D" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- ESTOQUE ---------------- */

function EstoqueTab({ insumos, setInsumos }) {
  const [form, setForm] = useState({ name: "", unit: "", qty: "", minQty: "" });
  const add = () => {
    if (!form.name) return;
    setInsumos([...insumos, { id: genId(), name: form.name, unit: form.unit || "un", qty: parseFloat(form.qty) || 0, minQty: parseFloat(form.minQty) || 0 }]);
    setForm({ name: "", unit: "", qty: "", minQty: "" });
  };
  const adjust = (id, delta) => setInsumos(insumos.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)));
  const remove = (id) => setInsumos(insumos.filter((i) => i.id !== id));
  return (
    <div className="space-y-4">
      <div className="pdv-card rounded-lg p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <Field label="Insumo" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Unidade" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
        <Field label="Qtd. atual" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} numeric />
        <Field label="Estoque mín." value={form.minQty} onChange={(v) => setForm({ ...form, minQty: v })} numeric />
        <button onClick={add} className="py-2 rounded font-medium" style={{ background: "#C99A4A", color: "#231912" }}>Adicionar</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {insumos.map((i) => {
          const low = i.qty <= i.minQty;
          return (
            <div key={i.id} className="pdv-card rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium flex items-center gap-1" style={{ color: "#F2E9DA" }}>{i.name} {low && <AlertTriangle size={13} color="#E0A36E" />}</div>
                <div className="pdv-mono text-xs" style={{ color: low ? "#E0A36E" : "#C9B79C" }}>{i.qty} {i.unit} (mín. {i.minQty})</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => adjust(i.id, -1)} className="p-1.5 rounded" style={{ background: "#3A2A1F" }}><Minus size={13} color="#F2E9DA" /></button>
                <button onClick={() => adjust(i.id, 1)} className="p-1.5 rounded" style={{ background: "#3A2A1F" }}><Plus size={13} color="#F2E9DA" /></button>
                <button onClick={() => remove(i.id)} className="p-1.5"><Trash2 size={13} color="#C1553D" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- EQUIPE ---------------- */

function EquipeTab({ funcionarios, setFuncionarios, currentEmployee }) {
  const [form, setForm] = useState({ name: "", pin: "", role: "funcionario" });
  const add = () => {
    if (!form.name || form.pin.length !== 4) return;
    setFuncionarios([...funcionarios, { id: genId(), name: form.name, pin: form.pin, role: form.role }]);
    setForm({ name: "", pin: "", role: "funcionario" });
  };
  const remove = (id) => setFuncionarios(funcionarios.filter((f) => f.id !== id));
  const isDono = currentEmployee.role === "dono";
  return (
    <div className="space-y-4 max-w-md">
      {isDono && (
        <div className="pdv-card rounded-lg p-4 space-y-2">
          <Field label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="PIN (4 dígitos)" value={form.pin} onChange={(v) => setForm({ ...form, pin: v.replace(/\D/g, "").slice(0, 4) })} numeric />
          <label className="text-xs block" style={{ color: "#C9B79C" }}>
            Cargo
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="block w-full mt-1 px-2 py-1.5 rounded text-sm" style={{ background: "#231912", border: "1px solid #4A3B2A", color: "#F2E9DA" }}>
              <option value="funcionario">Funcionário</option>
              <option value="dono">Dono (vê o Caixa)</option>
            </select>
          </label>
          <button onClick={add} className="w-full py-2 rounded font-medium" style={{ background: "#C99A4A", color: "#231912" }}>Cadastrar funcionário</button>
        </div>
      )}
      <div className="space-y-2">
        {funcionarios.map((f) => (
          <div key={f.id} className="pdv-card rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm" style={{ color: "#F2E9DA" }}>
              {f.name} {f.role === "dono" && <span className="pdv-mono text-xs" style={{ color: "#C99A4A" }}>· dono</span>}
            </span>
            {isDono && <button onClick={() => remove(f.id)}><Trash2 size={14} color="#C1553D" /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- CAIXA ---------------- */

function CaixaTab({ vendas, filtro, setFiltro, setComandas, comandas }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const excluirVenda = (id) => {
    setComandas(comandas.filter((c) => c.id !== id));
    setConfirmDelete(null);
  };
  const total = vendas.reduce((s, v) => s + v.total, 0);
  const lucro = vendas.reduce((s, v) => s + v.profit, 0);
  const porPagamento = PAY_METHODS.reduce((acc, m) => { acc[m] = vendas.filter((v) => v.paymentMethod === m).reduce((s, v) => s + v.total, 0); return acc; }, {});
  const porFuncionario = {};
  vendas.forEach((v) => { porFuncionario[v.closedBy] = (porFuncionario[v.closedBy] || 0) + v.total; });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[{ id: "hoje", label: "Hoje" }, { id: "todos", label: "Todo o período" }].map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)} className="px-3 py-1.5 rounded text-sm"
            style={{ background: filtro === f.id ? "#C99A4A" : "#3A2A1F", color: filtro === f.id ? "#231912" : "#C9B79C" }}>{f.label}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total vendido" value={fmtBRL(total)} color="#F2E9DA" />
        <Stat label="Lucro" value={fmtBRL(lucro)} color="#7C8A5C" />
        <Stat label="Comandas pagas" value={vendas.length} color="#F2E9DA" />
        <Stat label="Margem média" value={total ? `${((lucro / total) * 100).toFixed(0)}%` : "—"} color="#C99A4A" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PAY_METHODS.map((m) => (
          <div key={m} className="pdv-card rounded-lg p-3">
            <div className="text-xs" style={{ color: "#C9B79C" }}>{m}</div>
            <div className="pdv-mono text-lg" style={{ color: "#F2E9DA" }}>{fmtBRL(porPagamento[m])}</div>
          </div>
        ))}
      </div>

      {Object.keys(porFuncionario).length > 0 && (
        <div className="pdv-card rounded-lg p-4">
          <h4 className="pdv-serif text-sm mb-2" style={{ color: "#C99A4A" }}>Por funcionário</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(porFuncionario).map(([nome, val]) => (
              <div key={nome} className="text-sm" style={{ color: "#F2E9DA" }}>
                {nome}: <span className="pdv-mono">{fmtBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pdv-card rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr style={{ color: "#C99A4A" }} className="text-left">
            <th className="p-3">Ticket</th><th className="p-3">Hora</th><th className="p-3">Itens</th><th className="p-3">Pagamento</th><th className="p-3">Funcionário</th><th className="p-3">Total</th><th className="p-3">Lucro</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {vendas.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt)).map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid #4A3B2A", color: "#F2E9DA" }}>
                <td className="p-3 pdv-mono">#{v.ticketNumber}</td>
                <td className="p-3 pdv-mono">{new Date(v.closedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-3" style={{ color: "#C9B79C" }}>{v.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}</td>
                <td className="p-3">{v.paymentMethod}</td>
                <td className="p-3" style={{ color: "#C9B79C" }}>{v.closedBy}</td>
                <td className="p-3 pdv-mono">{fmtBRL(v.total)}</td>
                <td className="p-3 pdv-mono" style={{ color: "#7C8A5C" }}>{fmtBRL(v.profit)}</td>
                <td className="p-3">
                  {confirmDelete === v.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => excluirVenda(v.id)} className="text-xs px-2 py-1 rounded" style={{ background: "#C1553D", color: "#F2E9DA" }}>Confirmar</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 rounded" style={{ background: "#3A2A1F", color: "#C9B79C" }}>Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(v.id)} title="Excluir esta venda"><Trash2 size={14} color="#C1553D" /></button>
                  )}
                </td>
              </tr>
            ))}
            {vendas.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center" style={{ color: "#8A7863" }}>Nenhuma comanda paga neste período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- SHARED UI ---------------- */

function ReceiptPrint({ data }) {
  if (!data) return <div className="pdv-receipt-print" />;
  const now = new Date(data.timestamp || Date.now());
  const dataHora = now.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (data.type === "ticket") {
    return (
      <div className="pdv-receipt-print">
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "14px" }}>DHOMINI CAFÉ</div>
        <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "6px" }}>{dataHora}</div>
        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
        <div style={{ textAlign: "center", fontSize: "11px", marginTop: "6px" }}>SENHA</div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "42px", lineHeight: 1 }}>#{data.comanda.ticketNumber}</div>
        {data.comanda.clientName && (
          <div style={{ textAlign: "center", fontSize: "11px", marginTop: "4px" }}>{data.comanda.clientName}</div>
        )}
        <div style={{ borderTop: "1px dashed #000", margin: "8px 0 4px" }} />
        <div style={{ textAlign: "center", fontSize: "10px" }}>Guarde este número para pagar</div>
      </div>
    );
  }

  // type === "comprovante"
  const c = data.comanda;
  const total = c.items.reduce((s, it) => s + it.price * it.qty, 0);
  return (
    <div className="pdv-receipt-print">
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: "14px" }}>DHOMINI CAFÉ</div>
      <div style={{ textAlign: "center", fontSize: "10px", marginBottom: "6px" }}>{dataHora}</div>
      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />
      <div style={{ fontSize: "11px" }}>Comanda #{c.ticketNumber} {c.clientName ? `· ${c.clientName}` : ""}</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      {c.items.map((it, i) => (
        <div key={i} style={{ fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
          <span>{it.qty}x {it.name}</span>
          <span>{fmtBRL(it.price * it.qty)}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ fontSize: "13px", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>TOTAL</span><span>{fmtBRL(total)}</span>
      </div>
      <div style={{ fontSize: "10px", marginTop: "2px" }}>Pagamento: {c.paymentMethod || "-"}</div>
      <div style={{ borderTop: "1px dashed #000", margin: "8px 0 4px" }} />
      <div style={{ textAlign: "center", fontSize: "10px" }}>Obrigado, volte sempre!</div>
    </div>
  );
}
  return (
    <label className="text-xs" style={{ color: "#C9B79C" }}>
      {label}
      <input type={numeric ? "text" : "text"} inputMode={numeric ? "numeric" : "text"} value={value} onChange={(e) => onChange(e.target.value)}
        className="block w-full mt-1 px-2 py-1.5 rounded text-sm" style={{ background: "#231912", border: "1px solid #4A3B2A", color: "#F2E9DA" }} />
    </label>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="pdv-card rounded-lg p-3">
      <div className="text-xs" style={{ color: "#C9B79C" }}>{label}</div>
      <div className="pdv-serif text-xl" style={{ color }}>{value}</div>
    </div>
  );
}
