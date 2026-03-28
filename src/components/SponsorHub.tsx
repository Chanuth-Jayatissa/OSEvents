import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, SlidersHorizontal, Search } from "lucide-react";
import Icosahedron from "./Icosahedron";

interface Lead {
  id: string;
  company: string;
  industry: string;
  contact: string;
  score: number;
  status: "ready" | "loading" | "contacted";
}

const leads: Lead[] = [
  { id: "1", company: "Vercel", industry: "DevTools", contact: "Sarah Chen", score: 96, status: "ready" },
  { id: "2", company: "Stripe", industry: "FinTech", contact: "Marcus Webb", score: 93, status: "ready" },
  { id: "3", company: "Figma", industry: "Design", contact: "", score: 0, status: "loading" },
  { id: "4", company: "Notion", industry: "Productivity", contact: "Ava Patel", score: 88, status: "ready" },
  { id: "5", company: "Cloudflare", industry: "Infrastructure", contact: "James Liu", score: 91, status: "contacted" },
  { id: "6", company: "Linear", industry: "DevTools", contact: "Nina Vasquez", score: 85, status: "ready" },
  { id: "7", company: "Supabase", industry: "Database", contact: "", score: 0, status: "loading" },
  { id: "8", company: "Datadog", industry: "Observability", contact: "Tom Richter", score: 79, status: "ready" },
];

const SponsorHub = () => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [autoScan, setAutoScan] = useState(true);

  const totalLeads = leads.length;
  const pending = leads.filter((l) => l.status === "loading").length;
  const contacted = leads.filter((l) => l.status === "contacted").length;
  const avgScore = Math.round(leads.filter((l) => l.score > 0).reduce((a, b) => a + b.score, 0) / leads.filter((l) => l.score > 0).length);

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
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">Search Radius</span>
            <input type="range" min="10" max="100" defaultValue={50} className="w-full accent-gold h-1" />
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-2">Industry</span>
            {["DevTools", "FinTech", "Design", "Infrastructure", "Database"].map((ind) => (
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
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card border-b border-border z-10">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Company</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Industry</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Contact</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Match Score</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-normal">Action</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <motion.tr
                  key={lead.id}
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
                      <span
                        className={`font-mono font-semibold ${lead.score >= 90 ? "text-primary text-gold-glow" : "text-foreground"}`}
                      >
                        {lead.score}%
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
                    {selectedLead.company} is a strong match for GDG Annual Gala 2026 based on their {selectedLead.industry.toLowerCase()} focus and community involvement. Match score: {selectedLead.score}%.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground block mb-1">Draft Message</span>
                  <div className="bg-muted rounded-md p-3 text-xs text-foreground/80 leading-relaxed font-mono">
                    Hi {selectedLead.contact?.split(" ")[0]},<br /><br />
                    I'm reaching out on behalf of the GDG Annual Gala 2026 organizing team. Given {selectedLead.company}'s incredible work in {selectedLead.industry.toLowerCase()}, we believe a partnership would create tremendous value for both our communities.<br /><br />
                    The Gala brings together 2,000+ developers and industry leaders. We'd love to explore sponsorship opportunities that align with your brand goals.<br /><br />
                    Would you be open to a quick call this week?<br /><br />
                    Best regards,<br />
                    EventOS Team
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-border">
                <button
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
