import { useState, useRef, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const CATEGORY_COLORS = {
  "Food & Dining": "#f59e0b",
  Shopping: "#7c3aed",
  Transport: "#3b82f6",
  Entertainment: "#ec4899",
  Utilities: "#14b8a6",
  Income: "#10b981",
  Healthcare: "#ef4444",
  Other: "#6b7280",
};

const CATEGORY_ICONS = {
  "Food & Dining": "🍜",
  Shopping: "🛍️",
  Transport: "🚗",
  Entertainment: "🎬",
  Utilities: "💡",
  Income: "💰",
  Healthcare: "🏥",
  Other: "📦",
};

const SUGGESTIONS = [
  "What did I spend the most on?",
  "How can I save more money?",
  "Show my monthly spending trend",
  "Find transactions above ₹5000",
  "What's my savings rate?",
  "Give me a budget breakdown",
];

function formatINR(n) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function Avatar({ name }) {
  const colors = ["#00d4aa", "#7c3aed", "#f59e0b", "#3b82f6", "#ec4899"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%",
      background: colors[idx], color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {name[0].toUpperCase()}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "var(--accent)",
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = "var(--accent)" }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 6,
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.3)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function DonutChart({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (!total) return null;
  let offset = 0;
  const R = 70, C = 2 * Math.PI * R;
  const slices = Object.entries(data)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const pct = val / total;
      const stroke = pct * C;
      const slice = { cat, val, pct, stroke, offset };
      offset += stroke;
      return slice;
    });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={R} fill="none" stroke="var(--border)" strokeWidth={24} />
        {slices.map(({ cat, stroke, offset: off, pct }) => (
          <circle key={cat} cx={90} cy={90} r={R} fill="none"
            stroke={CATEGORY_COLORS[cat] || "#6b7280"}
            strokeWidth={24}
            strokeDasharray={`${stroke} ${C - stroke}`}
            strokeDashoffset={-off + C * 0.25}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          >
            <title>{cat}: {(pct * 100).toFixed(1)}%</title>
          </circle>
        ))}
        <text x={90} y={86} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={600}>Total</text>
        <text x={90} y={102} textAnchor="middle" fill="var(--accent)" fontSize={13} fontWeight={700}>
          ₹{Math.round(total / 1000)}k
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {slices.map(({ cat, val, pct }) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: CATEGORY_COLORS[cat] || "#6b7280", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 120 }}>
              {CATEGORY_ICONS[cat] || "📦"} {cat}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>
              {formatINR(val)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({(pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex", gap: 12,
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start",
      animation: "fadeUp 0.3s ease",
    }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg,#00d4aa,#7c3aed)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0, boxShadow: "0 0 12px rgba(0,212,170,0.3)",
        }}>💰</div>
      )}
      {isUser && <Avatar name="Y" />}
      <div style={{
        maxWidth: "75%",
        background: isUser
          ? "linear-gradient(135deg,#00d4aa22,#7c3aed22)"
          : "var(--bg-card2)",
        border: `1px solid ${isUser ? "rgba(0,212,170,0.25)" : "var(--border)"}`,
        borderRadius: isUser ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
        padding: "12px 16px",
      }}>
        {msg.loading
          ? <Spinner />
          : <p style={{
              fontSize: 14, lineHeight: 1.65,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
              fontFamily: msg.role === "assistant" ? "Inter, sans-serif" : "Inter, sans-serif",
            }}>{msg.content}</p>
        }
        {msg.time && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, textAlign: isUser ? "right" : "left" }}>
            {msg.time}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hey! I'm **FinBot**, your personal finance AI.\n\nUpload your bank statement (CSV or PDF) to get started, or load the demo data to try me out. I can:\n• 📊 Summarize your spending\n• 💡 Give savings advice\n• 🔍 Find unusual transactions\n• 📅 Show monthly trends",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState("chat"); // chat | analytics | transactions
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const fetchStats = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
       
        fetch(`${API}/transactions`).then(r => r.json()),
      ]);
      
      setTransactions(t.transactions || []);
    } catch { /* silent */ }
  }, []);

const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { role: "user", content: msg, time }, { role: "assistant", content: "", loading: true, time }]);
    setLoading(true);
    try {
      console.log("🔵 Sending:", msg);
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });
      
      console.log("🟢 Response status:", res.status);
      const data = await res.json();
      console.log("🟡 Response data:", data);
      
      // Handle response - check for both response and error fields
      const responseText = data.response || data.error || "No response received";
      
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: responseText, time }]);
      fetchStats();
    } catch (error) {
      console.error("🔴 Error:", error);
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "⚠️ Could not reach the server. Make sure the backend is running at " + API, time }]);
    }
    setLoading(false);
  };
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
   
    form.append("session_id", sessionId);
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, {
      role: "user", content: `📎 Uploaded: ${file.name}`, time,
    }, { role: "assistant", content: "", loading: true, time }]);
    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      const data = await res.json();
      setMessages(prev => [...prev.slice(0, -1), {
        role: "assistant",
        content: `✅ Loaded **${data.transaction_count}** transactions from **${file.name}**!\n\nYou can now ask me anything about your spending. Try:\n• "What did I spend the most on?"\n• "Show my monthly trend"\n• "How can I save more?"`,
        time,
      }]);
      fetchStats();
    } catch {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "❌ Upload failed. Please try again.", time }]);
    }
    setUploading(false);
  };

  const loadDemo = async () => {
    const fake = new File(["demo"], "demo_data.txt", { type: "text/plain" });
    await upload(fake);
  };

  const spendingCats = stats?.categories
    ? Object.fromEntries(Object.entries(stats.categories).filter(([k]) => k !== "Income"))
    : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* ── Header ── */}
      <header style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg,#00d4aa,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, boxShadow: "0 0 16px rgba(0,212,170,0.3)",
          }}>💰</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>
              Fin<span style={{ color: "var(--accent)" }}>Bot</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -2 }}>Personal Finance AI</div>
          </div>
        </div>

        <nav style={{ display: "flex", gap: 4 }}>
          {["chat", "analytics", "transactions"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
              background: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "#000" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}>
              {t === "chat" ? "💬 Chat" : t === "analytics" ? "📊 Analytics" : "📋 Transactions"}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadDemo} disabled={uploading} style={{
            padding: "7px 16px", borderRadius: 8,
            border: "1px solid var(--border-light)",
            background: "transparent", color: "var(--text-secondary)",
            fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "Inter, sans-serif",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-light)"}
          >
            {uploading ? "Loading…" : "🎲 Load Demo"}
          </button>
          <button onClick={() => fileRef.current?.click()} style={{
            padding: "7px 16px", borderRadius: 8,
            background: "linear-gradient(135deg,#00d4aa,#0891b2)",
            border: "none", color: "#000",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
            transition: "opacity 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            📎 Upload Statement
          </button>
          <input ref={fileRef} type="file" accept=".csv,.pdf" style={{ display: "none" }}
            onChange={e => { upload(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <StatCard icon="💸" label="Total Spent" value={formatINR(stats.total_spent)} color="var(--danger)" sub="This period" />
            <StatCard icon="💰" label="Total Income" value={formatINR(stats.total_income)} color="var(--success)" sub="This period" />
            <StatCard icon="📈" label="Savings" value={formatINR(Math.max(0, stats.total_income - stats.total_spent))} color="var(--accent)" sub={stats.total_income ? `${((1 - stats.total_spent / stats.total_income) * 100).toFixed(0)}% rate` : ""} />
            <StatCard icon="🔢" label="Transactions" value={stats.transaction_count} color="var(--accent2)" sub="Loaded" />
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Messages */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "24px",
              minHeight: 400, maxHeight: 520, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 18,
            }}>
              {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} disabled={loading} style={{
                  padding: "6px 14px", borderRadius: 999,
                  border: "1px solid var(--border-light)",
                  background: "var(--bg-card)", color: "var(--text-secondary)",
                  fontSize: 12, cursor: "pointer", fontFamily: "Inter, sans-serif",
                  transition: "all 0.2s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-light)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >{s}</button>
              ))}
            </div>

            {/* Input */}
            <div style={{
              display: "flex", gap: 10,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "10px 14px",
              transition: "border-color 0.2s",
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = "var(--accent)"}
              onBlurCapture={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask about your spending, savings, trends…"
                disabled={loading}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: "var(--text-primary)", fontSize: 14, fontFamily: "Inter, sans-serif",
                }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()} style={{
                width: 38, height: 38, borderRadius: 10,
                background: input.trim() ? "linear-gradient(135deg,#00d4aa,#0891b2)" : "var(--border)",
                border: "none", cursor: input.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, transition: "all 0.2s", flexShrink: 0,
              }}>➤</button>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {stats && Object.keys(spendingCats).length > 0 ? (
              <>
                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: 28,
                }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 22, color: "var(--text-primary)" }}>
                    📊 Spending Breakdown
                  </h2>
                  <DonutChart data={spendingCats} />
                </div>

                <div style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius)", padding: 28,
                }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>📋 Category Details</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {Object.entries(spendingCats)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, val]) => {
                        const total = Object.values(spendingCats).reduce((a, b) => a + b, 0);
                        const pct = (val / total) * 100;
                        return (
                          <div key={cat}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>
                                {CATEGORY_ICONS[cat] || "📦"} {cat}
                              </span>
                              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pct.toFixed(1)}%</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: CATEGORY_COLORS[cat], fontFamily: "JetBrains Mono, monospace" }}>
                                  {formatINR(val)}
                                </span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: "var(--border)", borderRadius: 99 }}>
                              <div style={{
                                height: "100%", borderRadius: 99,
                                background: CATEGORY_COLORS[cat] || "#6b7280",
                                width: `${pct}%`,
                                transition: "width 0.8s ease",
                              }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: 60, textAlign: "center",
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>No data yet</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Upload a bank statement or load demo data to see analytics</div>
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === "transactions" && (
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius)", overflow: "hidden",
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>📋 Transactions</h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-card2)", padding: "4px 10px", borderRadius: 99 }}>
                {transactions.length} shown
              </span>
            </div>
            {transactions.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>No transactions loaded yet</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-card2)" }}>
                      {["Date", "Description", "Category", "Amount"].map(h => (
                        <th key={h} style={{
                          padding: "12px 20px", textAlign: h === "Amount" ? "right" : "left",
                          color: "var(--text-muted)", fontWeight: 600, fontSize: 12,
                          textTransform: "uppercase", letterSpacing: "0.05em",
                          borderBottom: "1px solid var(--border)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-card2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ padding: "13px 20px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
                          {t.date}
                        </td>
                        <td style={{ padding: "13px 20px", color: "var(--text-primary)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.description}
                        </td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{
                            padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: `${CATEGORY_COLORS[t.category] || "#6b7280"}22`,
                            color: CATEGORY_COLORS[t.category] || "#6b7280",
                          }}>
                            {CATEGORY_ICONS[t.category] || "📦"} {t.category}
                          </span>
                        </td>
                        <td style={{
                          padding: "13px 20px", textAlign: "right", fontWeight: 700,
                          fontFamily: "JetBrains Mono, monospace",
                          color: t.amount >= 0 ? "var(--success)" : "var(--danger)",
                        }}>
                          {t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-card)",
      }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Built by <a href="mailto:omnaik6969@gmail.com" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Om Naik</a>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 16 }}>
          <span>Python · FastAPI · LangChain · React</span>
          <span style={{ color: "var(--border-light)" }}>|</span>
          <a href="https://github.com/omnaik" target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>GitHub ↗</a>
        </div>
      </footer>
    </div>
  );
}
