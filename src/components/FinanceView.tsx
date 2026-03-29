import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, PieChart, Download, FileSpreadsheet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Icosahedron from "./Icosahedron";
import { fetchBudgets, AgentLog } from "@/lib/api";
import { useEventBus } from "@/contexts/EventBusContext";
import { toast } from "sonner";

const FinanceView = () => {
  const { activeProjectId, sendGlobalCommand, addLog, setTabNotification } = useEventBus();

  const { data: budget, isLoading } = useQuery({
    queryKey: ["budgets", activeProjectId],
    queryFn: () => fetchBudgets(activeProjectId),
    refetchInterval: 5000,
  });

  const totalBudget = budget?.total_budget ?? 0;
  const totalSpent = budget?.total_spent ?? 0;
  const remaining = totalBudget - totalSpent;
  const runwayPct = totalBudget > 0 ? ((remaining / totalBudget) * 100) : 100;
  const categories = budget?.categories ?? [];

  const runwayColor = runwayPct > 50 ? "text-green-400" : runwayPct > 20 ? "text-yellow-400" : "text-red-400";
  const runwayBg = runwayPct > 50 ? "bg-green-400" : runwayPct > 20 ? "bg-yellow-400" : "bg-red-400";

  const handleGenerateBudget = async () => {
    try {
      addLog({
        timestamp: new Date().toISOString(),
        agent_name: "FINANCE",
        domain: "finance",
        message: "Budget generation triggered from Finance tab",
        level: "info",
      });
      setTabNotification("command", true);
      await sendGlobalCommand("Plan a budget for a 500-person hackathon spanning 2 days");
      toast.success("Budget Planner agent dispatched");
    } catch {
      toast.error("Failed to trigger budget generation");
    }
  };

  const getSpentPct = (cat: { estimated: number; actual: number }) => {
    return cat.estimated > 0 ? (cat.actual / cat.estimated) * 100 : 0;
  };

  const getBarColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Summary Cards */}
      <div className="h-32 border-b border-border bg-card px-6 flex items-center gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="flex-1 p-4 rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-primary" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Total Budget</span>
          </div>
          <span className="font-heading text-2xl text-primary text-gold-glow">${totalBudget.toLocaleString()}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 p-4 rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-electric" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Total Spent</span>
          </div>
          <span className="font-heading text-2xl text-foreground">${totalSpent.toLocaleString()}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 p-4 rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-brass" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Remaining</span>
          </div>
          <span className="font-heading text-2xl text-foreground">${remaining.toLocaleString()}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex-1 p-4 rounded-lg border border-border bg-muted/30"
        >
          <div className="flex items-center gap-2 mb-1">
            <PieChart size={14} className={runwayColor} />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Runway</span>
          </div>
          <span className={`font-heading text-2xl ${runwayColor}`}>{runwayPct.toFixed(0)}%</span>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Icosahedron size={32} spinning />
            <span className="text-sm text-muted-foreground">Loading budget data...</span>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/40">
            <DollarSign size={48} />
            <p className="text-sm text-muted-foreground">No budget created yet</p>
            <button
              onClick={handleGenerateBudget}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
              style={{ boxShadow: "0 0 20px hsl(43 72% 55% / 0.3)" }}
            >
              <FileSpreadsheet size={16} /> Generate Budget
            </button>
          </div>
        ) : (
          <>
            {/* Actions */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm text-primary">Budget Breakdown</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateBudget}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brass/40 text-brass text-xs hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <FileSpreadsheet size={12} /> Regenerate
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-brass/40 text-brass text-xs hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Download size={12} /> Export Excel
                </button>
              </div>
            </div>

            {/* Category Table */}
            <div className="space-y-3">
              {categories.map((cat, i) => {
                const pct = getSpentPct(cat);
                return (
                  <motion.div
                    key={cat.name || i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-card border border-border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        {cat.notes && (
                          <span className="text-[10px] text-muted-foreground ml-2">— {cat.notes}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-muted-foreground">
                          Est: <span className="text-foreground">${cat.estimated.toLocaleString()}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Act: <span className={pct > 100 ? "text-red-400" : "text-foreground"}>
                            ${cat.actual.toLocaleString()}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Rem: <span className="text-foreground">
                            ${(cat.estimated - cat.actual).toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${getBarColor(pct)}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {pct.toFixed(0)}% spent
                      </span>
                      {pct > 100 && (
                        <span className="text-[9px] font-mono text-red-400">
                          OVERRUN by ${(cat.actual - cat.estimated).toLocaleString()}
                        </span>
                      )}
                      {pct > 80 && pct <= 100 && (
                        <span className="text-[9px] font-mono text-yellow-400">
                          Approaching limit
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Total Summary */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5"
              style={{ boxShadow: "0 0 12px hsl(43 72% 55% / 0.15)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-heading text-sm text-primary">Total</span>
                <div className="flex items-center gap-6 font-mono">
                  <span className="text-sm text-foreground">${totalBudget.toLocaleString()}</span>
                  <span className="text-sm text-foreground">${totalSpent.toLocaleString()}</span>
                  <span className={`text-sm font-semibold ${remaining >= 0 ? "text-green-400" : "text-red-400"}`}>
                    ${remaining.toLocaleString()}
                  </span>
                  {/* Overall progress */}
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${runwayBg}`}
                      style={{ width: `${Math.min(100 - runwayPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinanceView;
