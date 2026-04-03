import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Users, CreditCard, AlertTriangle, CloudLightning, Wallet,
  LayoutDashboard, TrendingUp, TrendingDown, ArrowUpRight,
  Search, Bell, ChevronDown, Shield, BarChart3, Settings,
  LogOut, Menu, X, Eye, CheckCircle2, XCircle, Clock,
  DollarSign, Activity, Zap
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { Helmet } from "react-helmet-async";

/* ───────── Mock Data ───────── */
const userGrowth = [
  { month: "Sep", users: 820 }, { month: "Oct", users: 1240 },
  { month: "Nov", users: 1580 }, { month: "Dec", users: 2100 },
  { month: "Jan", users: 2780 }, { month: "Feb", users: 3450 },
  { month: "Mar", users: 4120 },
];

const subsByPlan = [
  { name: "Basic", value: 1240, color: "#3b82f6" },
  { name: "Pro", value: 890, color: "#8b5cf6" },
  { name: "Enterprise", value: 320, color: "#10b981" },
];

const revenueData = [
  { month: "Sep", revenue: 12400 }, { month: "Oct", revenue: 18600 },
  { month: "Nov", revenue: 22100 }, { month: "Dec", revenue: 28500 },
  { month: "Jan", revenue: 34200 }, { month: "Feb", revenue: 41800 },
  { month: "Mar", revenue: 48600 },
];

const disruptions = [
  { id: 1, type: "Flight Delay", location: "DEL → BOM", severity: "high", status: "active", time: "12 min ago", affected: 142 },
  { id: 2, type: "Weather Alert", location: "Mumbai Region", severity: "medium", status: "active", time: "28 min ago", affected: 89 },
  { id: 3, type: "Train Cancel", location: "Rajdhani Express", severity: "high", status: "monitoring", time: "1h ago", affected: 234 },
  { id: 4, type: "Road Closure", location: "NH-48 Gurugram", severity: "low", status: "resolved", time: "3h ago", affected: 56 },
  { id: 5, type: "Flight Cancel", location: "BLR → HYD", severity: "high", status: "active", time: "45 min ago", affected: 198 },
];

const payouts = [
  { id: "PAY-2847", user: "Arjun Mehta", amount: 12500, status: "completed", date: "Mar 28, 2026", method: "UPI" },
  { id: "PAY-2846", user: "Priya Sharma", amount: 8200, status: "processing", date: "Mar 27, 2026", method: "Bank" },
  { id: "PAY-2845", user: "Vikram Singh", amount: 45000, status: "completed", date: "Mar 27, 2026", method: "UPI" },
  { id: "PAY-2844", user: "Sneha Patel", amount: 3400, status: "failed", date: "Mar 26, 2026", method: "Bank" },
  { id: "PAY-2843", user: "Rahul Kumar", amount: 15800, status: "completed", date: "Mar 26, 2026", method: "UPI" },
  { id: "PAY-2842", user: "Ananya Desai", amount: 22000, status: "processing", date: "Mar 25, 2026", method: "Bank" },
];

const fraudAlerts = [
  { id: 1, user: "user_x892", type: "Duplicate Claim", risk: 92, desc: "Same disruption claimed 3x from different accounts", time: "5 min ago", status: "unreviewed" },
  { id: 2, user: "user_k421", type: "Velocity Abuse", risk: 87, desc: "14 claims in 48 hours — abnormal pattern", time: "18 min ago", status: "unreviewed" },
  { id: 3, user: "user_m133", type: "Identity Mismatch", risk: 78, desc: "KYC data doesn't match booking details", time: "1h ago", status: "investigating" },
  { id: 4, user: "user_p567", type: "GPS Spoofing", risk: 95, desc: "Location data inconsistent with claimed disruption", time: "2h ago", status: "flagged" },
  { id: 5, user: "user_r901", type: "Synthetic ID", risk: 88, desc: "Account matches synthetic identity patterns", time: "4h ago", status: "investigating" },
];

const sidebarItems = [
  { icon: LayoutDashboard, label: "Overview", id: "overview" },
  { icon: Users, label: "Users", id: "users" },
  { icon: CreditCard, label: "Subscriptions", id: "subs" },
  { icon: CloudLightning, label: "Disruptions", id: "disruptions" },
  { icon: Wallet, label: "Payouts", id: "payouts" },
  { icon: AlertTriangle, label: "Fraud Alerts", id: "fraud" },
  { icon: BarChart3, label: "Analytics", id: "analytics" },
  { icon: Settings, label: "Settings", id: "settings" },
];

/* ───────── Helpers ───────── */
const severityColor: Record<string, string> = {
  high: "text-red-400 bg-red-400/10 border-red-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};
const statusColor: Record<string, string> = {
  active: "text-red-400", monitoring: "text-amber-400", resolved: "text-emerald-400",
  completed: "text-emerald-400", processing: "text-amber-400", failed: "text-red-400",
  unreviewed: "text-red-400", investigating: "text-amber-400", flagged: "text-orange-400",
};
const statusIcon: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2, processing: Clock, failed: XCircle,
};

function StatCard({ icon: Icon, label, value, change, changeType, accent }: {
  icon: typeof Users; label: string; value: string; change: string; changeType: "up" | "down"; accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-white/10 transition-all duration-300"
    >
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-10 ${accent}`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5`}>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium ${changeType === "up" ? "text-emerald-400" : "text-red-400"}`}>
          {changeType === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </motion.div>
  );
}

/* ───────── Main Component ───────── */
export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Helmet>
        <title>Admin Panel — KlaimKavach</title>
        <meta name="description" content="KlaimKavach admin dashboard for managing users, subscriptions, disruptions, payouts, and fraud alerts." />
      </Helmet>

      <div className="flex min-h-[calc(100vh-4rem)] -mx-4 sm:-mx-6 lg:-mx-8 -my-8">
        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside className={`
          fixed lg:sticky top-16 left-0 z-50 lg:z-auto h-[calc(100vh-4rem)] w-64 border-r border-border bg-background
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Admin Panel</p>
                <p className="text-[10px] text-muted-foreground">KlaimKavach</p>
              </div>
            </div>
            <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeSection === item.id
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.id === "fraud" && (
                  <span className="ml-auto bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">5</span>
                )}
                {item.id === "disruptions" && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-border">
            <Link href="/">
              <span className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all cursor-pointer">
                <LogOut className="w-4 h-4" /> Back to App
              </span>
            </Link>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <div className="sticky top-16 z-30 bg-background/80 backdrop-blur-md border-b border-border px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-2 rounded-lg hover:bg-white/5" onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold capitalize">{activeSection === "subs" ? "Subscriptions" : activeSection}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input placeholder="Search..." className="bg-transparent text-sm outline-none w-40 placeholder:text-muted-foreground" />
              </div>
              <button className="relative p-2 rounded-xl hover:bg-white/5 transition-colors">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>

                {/* ── OVERVIEW ── */}
                {(activeSection === "overview" || activeSection === "users" || activeSection === "subs" || activeSection === "analytics" || activeSection === "settings") && (
                  <div className="space-y-6">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <StatCard icon={Users} label="Total Users" value="4,120" change="+12.5%" changeType="up" accent="bg-blue-500" />
                      <StatCard icon={CreditCard} label="Active Subscriptions" value="2,450" change="+8.2%" changeType="up" accent="bg-violet-500" />
                      <StatCard icon={CloudLightning} label="Live Disruptions" value="3" change="-25%" changeType="down" accent="bg-amber-500" />
                      <StatCard icon={DollarSign} label="Total Payouts" value="₹4.86L" change="+18.4%" changeType="up" accent="bg-emerald-500" />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 glass-panel rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-semibold">Revenue Overview</h2>
                          <span className="text-xs text-muted-foreground">Last 7 months</span>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={revenueData}>
                            <defs>
                              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                            <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="url(#revGrad)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="glass-panel rounded-2xl p-5">
                        <h2 className="text-sm font-semibold mb-4">Subscriptions by Plan</h2>
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={subsByPlan} innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={4} strokeWidth={0}>
                              {subsByPlan.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                            </Pie>
                            <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-4 mt-2">
                          {subsByPlan.map((p) => (
                            <div key={p.name} className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                              <span className="text-[11px] text-muted-foreground">{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* User Growth */}
                    <div className="glass-panel rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold">User Growth</h2>
                        <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><TrendingUp className="w-3 h-3" /> +402% YoY</span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={userGrowth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="month" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                          <Bar dataKey="users" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* ── DISRUPTIONS ── */}
                {activeSection === "disruptions" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold">Live Disruption Feed</span>
                      <span className="ml-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    {disruptions.map((d, i) => (
                      <motion.div key={d.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className="glass-panel rounded-xl p-4 flex items-center justify-between gap-4 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`shrink-0 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase ${severityColor[d.severity]}`}>{d.severity}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{d.type} — {d.location}</p>
                            <p className="text-xs text-muted-foreground">{d.time} · {d.affected} users affected</p>
                          </div>
                        </div>
                        <span className={`shrink-0 text-xs font-semibold capitalize ${statusColor[d.status]}`}>{d.status}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* ── PAYOUTS ── */}
                {activeSection === "payouts" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold">Payout Logs</span>
                    </div>
                    <div className="glass-panel rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground">
                              <th className="text-left px-5 py-3 font-medium text-xs">ID</th>
                              <th className="text-left px-5 py-3 font-medium text-xs">User</th>
                              <th className="text-left px-5 py-3 font-medium text-xs">Amount</th>
                              <th className="text-left px-5 py-3 font-medium text-xs">Method</th>
                              <th className="text-left px-5 py-3 font-medium text-xs">Date</th>
                              <th className="text-left px-5 py-3 font-medium text-xs">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts.map((p, i) => {
                              const SIcon = statusIcon[p.status] || Clock;
                              return (
                                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                                  className="border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                                >
                                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                                  <td className="px-5 py-3 font-medium">{p.user}</td>
                                  <td className="px-5 py-3 tabular">₹{p.amount.toLocaleString()}</td>
                                  <td className="px-5 py-3 text-muted-foreground">{p.method}</td>
                                  <td className="px-5 py-3 text-muted-foreground">{p.date}</td>
                                  <td className="px-5 py-3">
                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${statusColor[p.status]}`}>
                                      <SIcon className="w-3 h-3" />{p.status}
                                    </span>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── FRAUD ALERTS ── */}
                {activeSection === "fraud" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-sm font-semibold">Fraud Alerts</span>
                      <span className="ml-2 bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">{fraudAlerts.length} active</span>
                    </div>
                    {fraudAlerts.map((a, i) => (
                      <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                        className="glass-panel rounded-xl p-5 hover:border-red-500/20 transition-all duration-300 group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">{a.type}</span>
                              <span className={`text-[10px] font-bold capitalize ${statusColor[a.status]}`}>• {a.status}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{a.desc}</p>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span className="font-mono">{a.user}</span>
                              <span>·</span>
                              <span>{a.time}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-center">
                            <div className={`text-lg font-bold tabular ${a.risk >= 90 ? "text-red-400" : a.risk >= 80 ? "text-orange-400" : "text-amber-400"}`}>{a.risk}%</div>
                            <div className="text-[10px] text-muted-foreground">risk</div>
                          </div>
                        </div>
                        {/* Risk bar */}
                        <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${a.risk}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                            className={`h-full rounded-full ${a.risk >= 90 ? "bg-red-500" : a.risk >= 80 ? "bg-orange-500" : "bg-amber-500"}`}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
