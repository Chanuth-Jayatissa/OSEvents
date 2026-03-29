import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Icosahedron from "./Icosahedron";
import { fetchLeads, sendCommand, Lead } from "@/lib/api";
import { toast } from "sonner";

const SponsorHub = () => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [autoScan, setAutoScan] = useState(true);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => fetchLeads(),
    refetchInterval: 5000,
  });

  const totalLeads = leads.length;
  const pending = leads.filter((l) => l.status === "loading").length;
  const contacted = leads.filter((l) => l.status === "contacted").length;
  const readyLeads = leads.filter((l) => l.score > 0);
  const avgScore = readyLeads.length > 0
    ? Math.round(readyLeads.reduce((a, b) => a + b.score, 0) / readyLeads.length)
    : 0;

  const handleOutreach = async (lead: Lead) => {
    try {
      await sendCommand(
        `Send outreach email to ${lead.contact} at ${lead.company} for sponsorship`,
        "default"
      );
      toast.success("Outreach initiated", {
        description: `Email agent drafting for ${lead.contact} at ${lead.company}`,
      });
      setSelectedLead(null);
    } catch (error) {
      toast.error("Failed to initiate outreach");
    }
  };

  const tierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "platinum": return "text-foreground bg-foreground/10";
      case "gold": return "text-primary bg-primary/10";
      case "silver": return "text-brass bg-brass/10";
      case "bronze": return "text-muted-foreground bg-muted";
      default: return "text-muted-foreground bg-muted";
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Stats Bar */}
      <div className="h-16 border-b border-border bg-card flex items-center px-6 gap-8">
        <div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block">Total Leads</span>
          <span className="font-mono text-lg text-primary">{totalLeads}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block">Pending Scan</span>
          <span className="font-mono text-lg text-electric">{pending}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block">Emails Sent</span>
          <span className="font-mono text-lg text-foreground">{contacted}</span>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block">Avg Match</span>
          <span className="font-heading text-2xl text-primary text-gold-glow">{avgScore}%</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Filter */}
        <div className="w-[220px] border-r border-border bg-card p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground font-medium">Auto-Scan</span>
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`w-9 h-5 rounded-full relative transition-colors ${autoScan ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-primary-foreground transition-transform ${autoScan ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">Industry</span>
            {[...new Set(leads.map((l) => l.industry).filter(Boolean))].slice(0, 6).map((ind) => (
              <label key={ind} className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                <input type="checkbox" defaultChecked className="w-3 h-3 rounded border-brass accent-gold" />
                {ind}
              </label>
            ))}
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">Tier</span>
            {["Platinum", "Gold", "Silver", "Bronze"].map((tier) => (
              <label key={tier} className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                <input type="checkbox" defaultChecked className="w-3 h-3 rounded border-brass accent-gold" />
                {tier}
              </label>
            ))}
          </div>
        </div>

        {/* Main Table */}
        <div className="flex-1 overflow-y-auto relative">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Icosahedron size={32} spinning />
              <span className="text-sm text-muted-foreground">Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/40">
              <Search size={48} />
              <p className="text-sm">No sponsor leads yet</p>
              <p className="text-[10px]">Use the Command Center: "Find 10 tech sponsors"</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Company</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Industry</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Contact</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Match</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Tier</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, i) => (
                  <motion.tr
                    key={lead.id || i}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      lead.status === "loading" ? "gold-shimmer" : "hover:bg-muted/30"
                    }`}
                    onClick={() => lead.status === "ready" && setSelectedLead(lead)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{lead.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.industry}</td>
                    <td className="px-4 py-3">
                      {lead.status === "loading" ? (
                        <div className="flex items-center gap-2">
                          <Icosahedron size={16} spinning />
                          <span className="text-muted-foreground/50 text-xs font-mono">Scanning...</span>
                        </div>
                      ) : (
                        <span className="text-foreground">{lead.contact}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.score > 0 ? (
                        <span className={`font-mono font-semibold ${lead.score >= 90 ? "text-primary text-gold-glow" : "text-foreground"}`}>
                          {lead.score}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.recommended_tier ? (
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded ${tierColor(lead.recommended_tier)}`}>
                          {lead.recommended_tier}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.status === "contacted" ? (
                        <span className="text-[10px] font-mono text-brass uppercase">Contacted</span>
                      ) : lead.status === "ready" ? (
                        <button
                          className="text-[10px] font-mono text-primary hover:text-gold-bright uppercase"
                          onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                        >
                          Reach Out →
                        </button>
                      ) : null}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Outreach Drawer */}
      <AnimatePresence>
        {selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-obsidian/50"
              onClick={() => setSelectedLead(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[420px] bg-card border-l border-border z-50 flex flex-col"
            >
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h3 className="font-heading text-lg text-primary">Outreach Draft</h3>
                <button onClick={() => setSelectedLead(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">Recipient</span>
                  <p className="text-sm text-foreground">{selectedLead.contact} — {selectedLead.company}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">Context</span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {selectedLead.company} is a strong match based on their {selectedLead.industry.toLowerCase()} focus.
                    Match score: {selectedLead.score}%.
                    {selectedLead.recommended_tier && ` Recommended tier: ${selectedLead.recommended_tier}.`}
                    {selectedLead.reasoning && ` ${selectedLead.reasoning}`}
                  </p>
                </div>
                {selectedLead.estimated_value > 0 && (
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">Estimated Value</span>
                    <p className="text-lg font-mono text-primary">${selectedLead.estimated_value.toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border">
                <button
                  onClick={() => handleOutreach(selectedLead)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
                  style={{ boxShadow: "0 0 20px hsl(43 72% 55% / 0.3)" }}
                >
                  <Send size={16} /> Execute Outreach
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SponsorHub;
