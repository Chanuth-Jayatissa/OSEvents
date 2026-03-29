import { useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Upload, FileCheck, AlertTriangle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Icosahedron from "./Icosahedron";
import { fetchRoadmap, fetchRules, uploadFile, Rule } from "@/lib/api";
import { toast } from "sonner";

const LogisticsView = () => {
  const { data: roadmapData } = useQuery({
    queryKey: ["roadmap"],
    queryFn: () => fetchRoadmap(),
    refetchInterval: 5000,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["rules"],
    queryFn: () => fetchRules(),
    refetchInterval: 5000,
  });

  const milestones = roadmapData?.milestones ?? [
    { id: "1", label: "Venue Booked", date: "Jan 15", done: true, current: false },
    { id: "2", label: "Speakers Confirmed", date: "Feb 20", done: true, current: false },
    { id: "3", label: "Sponsors Locked", date: "Mar 10", done: true, current: false },
    { id: "4", label: "Marketing Launch", date: "Mar 28", done: false, current: true },
    { id: "5", label: "Ticket Sales Open", date: "Apr 5", done: false, current: false },
    { id: "6", label: "Final Rehearsal", date: "May 25", done: false, current: false },
    { id: "7", label: "Event Day", date: "Jun 1", done: false, current: false },
  ];

  const tasks = roadmapData?.tasks ?? [
    { id: "1", text: "Finalize catering menu selections", done: true, priority: "normal" },
    { id: "2", text: "Review stage design with AV vendor", done: false, priority: "high" },
    { id: "3", text: "Confirm photographer schedule", done: false, priority: "normal" },
    { id: "4", text: "Send volunteer briefing packets", done: false, priority: "high" },
    { id: "5", text: "Test live-stream infrastructure", done: false, priority: "critical" },
    { id: "6", text: "Print and ship attendee badges", done: true, priority: "normal" },
    { id: "7", text: "Coordinate speaker transportation", done: false, priority: "normal" },
    { id: "8", text: "Verify insurance documentation", done: false, priority: "high" },
  ];

  const displayRules: Rule[] = rules.length > 0 ? rules : [
    { id: "1", text: "Max occupancy: 2,000 persons", severity: "info", category: "capacity" },
    { id: "2", text: "Sound curfew at 22:00 local", severity: "warning", category: "noise" },
    { id: "3", text: "Fire exits must remain unobstructed", severity: "critical", category: "safety" },
    { id: "4", text: "Catering license valid through Jun 30", severity: "info", category: "catering" },
    { id: "5", text: "Stage load bearing: 500kg max", severity: "warning", category: "safety" },
  ];

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }

    try {
      toast.info(`Uploading ${file.name}...`);
      const result = await uploadFile(file);
      toast.success(result.message);
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Master Timeline */}
      <div className="h-28 border-b border-border bg-card px-6 flex flex-col justify-center">
        <h3 className="font-heading text-sm text-primary mb-3">Master Timeline</h3>
        <div className="relative">
          <div className="absolute top-3 left-0 right-0 h-0.5 bg-brass/30" />
          <div
            className="absolute top-3 left-0 h-0.5 bg-primary"
            style={{
              width: `${(milestones.filter((m) => m.done).length / milestones.length) * 100}%`,
              boxShadow: "0 0 8px hsl(43 72% 55% / 0.4)",
            }}
          />
          <div className="flex justify-between relative">
            {milestones.map((m, i) => (
              <div key={m.id || i} className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center z-10 ${
                    m.done
                      ? "bg-primary text-primary-foreground"
                      : m.current
                      ? "bg-primary/20 border-2 border-primary text-primary"
                      : "bg-muted border border-border text-muted-foreground"
                  }`}
                  style={m.current ? { boxShadow: "0 0 12px hsl(43 72% 55% / 0.4)" } : {}}
                >
                  {m.done ? <CheckCircle size={12} /> : <Circle size={8} />}
                </div>
                <span className={`text-[9px] mt-1.5 ${m.done || m.current ? "text-primary" : "text-muted-foreground"} font-mono`}>
                  {m.date}
                </span>
                <span className={`text-[9px] ${m.current ? "text-foreground font-medium" : "text-muted-foreground"} max-w-[80px] text-center leading-tight`}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Compliance Shield */}
        <div className="w-[45%] border-r border-border flex flex-col overflow-hidden">
          {/* Drop Zone */}
          <div className="p-4 border-b border-border">
            <div
              className="border-2 border-dashed border-primary/25 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 transition-colors cursor-pointer"
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
            >
              <Upload size={20} className="text-primary/50" />
              <span className="text-xs text-muted-foreground">Drop venue contracts or compliance docs (PDF)</span>
            </div>
          </div>

          {/* Document Viewer */}
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 bg-obsidian p-4 flex items-center justify-center">
              <div className="text-center">
                <FileCheck size={32} className="text-brass/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-mono">venue_contract_v3.pdf</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Drop a PDF above to process</p>
              </div>
            </div>

            {/* Rules Sidebar */}
            <div className="w-48 border-l border-border bg-card p-3 overflow-y-auto">
              <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Extracted Rules</h4>
              <div className="space-y-2">
                {displayRules.map((rule, i) => (
                  <div key={rule.id || i} className="flex items-start gap-2 text-[11px]">
                    {rule.severity === "critical" ? (
                      <AlertTriangle size={12} className="text-destructive shrink-0 mt-0.5" />
                    ) : rule.severity === "warning" ? (
                      <AlertTriangle size={12} className="text-electric shrink-0 mt-0.5" />
                    ) : (
                      <Clock size={12} className="text-brass shrink-0 mt-0.5" />
                    )}
                    <span className="text-foreground/70 leading-relaxed">{rule.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Execution Matrix */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="font-heading text-sm text-primary mb-3">Execution Matrix</h3>
          <div className="space-y-2">
            {tasks.map((task, i) => (
              <motion.div
                key={task.id || i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-md bg-card border transition-all ${
                  task.priority === "critical"
                    ? "border-primary/30 border-gold-glow"
                    : task.priority === "high"
                    ? "border-brass/20"
                    : "border-border"
                }`}
              >
                <button className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  task.done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-brass/40 hover:border-primary"
                }`}>
                  {task.done && <CheckCircle size={12} />}
                </button>
                <span className={`text-sm ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {task.text}
                </span>
                {task.priority === "critical" && (
                  <span className="ml-auto text-[9px] font-mono uppercase text-primary bg-primary/10 px-2 py-0.5 rounded">Critical</span>
                )}
                {task.priority === "high" && (
                  <span className="ml-auto text-[9px] font-mono uppercase text-brass bg-brass/10 px-2 py-0.5 rounded">High</span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsView;
