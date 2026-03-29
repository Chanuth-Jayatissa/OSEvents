import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Film, Image, FileText, MapPin, Download, Share2, X, Play } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Icosahedron from "./Icosahedron";
import { fetchAssets, Asset } from "@/lib/api";
import { useEventBus } from "@/contexts/EventBusContext";

const categories = [
  { icon: Film, label: "Cinematics", filter: "video" },
  { icon: Image, label: "Creatives", filter: "image" },
  { icon: FileText, label: "Documents", filter: "document" },
  { icon: MapPin, label: "All Assets", filter: "all" },
];

const originAgents = ["Creative Designer", "Cinematic Creator"];

const VaultView = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const { activeProjectId } = useEventBus();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["assets", activeProjectId],
    queryFn: () => fetchAssets(activeProjectId),
    refetchInterval: 5000,
  });

  const filteredAssets = assets.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || a.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getCardClass = (index: number) => {
    if (index === 0) return "col-span-2 row-span-2";
    return "col-span-1 row-span-1";
  };

  const getCardHeight = (index: number) => {
    if (index === 0) return "h-64";
    return "h-40";
  };

  const typeCounts = {
    video: assets.filter((a) => a.type === "video").length,
    image: assets.filter((a) => a.type === "image").length,
    document: assets.filter((a) => a.type === "document").length,
    all: assets.length,
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Filter Panel */}
      <div className="w-[240px] border-r border-border bg-card p-4 flex flex-col gap-4 overflow-y-auto">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        <div>
          <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Categories</h4>
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setActiveFilter(cat.filter)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFilter === cat.filter
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-primary/5 hover:text-primary"
              }`}
            >
              <cat.icon size={14} className="text-primary" />
              <span>{cat.label}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                {typeCounts[cat.filter as keyof typeof typeCounts] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div>
          <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Origin Agent</h4>
          {originAgents.map((agent) => (
            <label key={agent} className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              <input type="checkbox" defaultChecked className="w-3 h-3 rounded border-brass accent-gold" />
              {agent}
            </label>
          ))}
        </div>
      </div>

      {/* Main Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Icosahedron size={32} spinning />
            <span className="text-sm text-muted-foreground">Loading assets...</span>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/40">
            <Image size={48} />
            <p className="text-sm">No assets yet</p>
            <p className="text-[10px]">Use the Command Center to generate content</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 auto-rows-min">
            {/* Ghost Card */}
            <motion.div
              className="col-span-1 row-span-1 h-40 border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center gap-3"
              animate={{ borderColor: ["hsl(43 72% 55% / 0.2)", "hsl(43 72% 55% / 0.5)", "hsl(43 72% 55% / 0.2)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icosahedron size={28} spinning />
              <span className="text-[10px] font-mono text-primary/60">Generate new asset...</span>
            </motion.div>

            {filteredAssets.map((asset, index) => (
              <motion.div
                key={asset.id || index}
                className={`${getCardClass(index)} ${getCardHeight(index)} relative rounded-lg overflow-hidden cursor-pointer group border transition-all ${
                  asset.type === "video"
                    ? "border-primary/20 hover:border-primary/50"
                    : asset.type === "image"
                    ? "border-brass/15 hover:border-brass/40"
                    : "border-border hover:border-brass/30"
                }`}
                style={asset.type === "image" ? { boxShadow: "0 0 12px hsl(33 35% 42% / 0.15)" } : {}}
                onClick={() => setSelectedAsset(asset)}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                <div className={`absolute inset-0 ${
                  asset.type === "video" ? "bg-gradient-to-br from-onyx to-obsidian" :
                  asset.type === "image" ? "bg-gradient-to-br from-muted to-onyx" :
                  "bg-card"
                }`} />

                {asset.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                      <Play size={16} className="text-primary ml-0.5" />
                    </div>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-obsidian/90 to-transparent">
                  <p className="text-xs font-medium text-foreground truncate">{asset.title}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{asset.meta}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/80 backdrop-blur-sm"
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-[90vw] max-w-5xl h-[80vh] bg-card border border-border rounded-xl flex overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-1 bg-obsidian flex items-center justify-center">
                <div className="text-center">
                  {selectedAsset.type === "video" && <Film size={48} className="text-primary mx-auto mb-3" />}
                  {selectedAsset.type === "image" && <Image size={48} className="text-brass mx-auto mb-3" />}
                  {selectedAsset.type === "document" && <FileText size={48} className="text-foreground/40 mx-auto mb-3" />}
                  <p className="text-sm text-muted-foreground font-mono">{selectedAsset.title}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedAsset.meta}</p>
                </div>
              </div>
              <div className="w-64 border-l border-border p-5 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-heading text-lg text-primary">Details</h3>
                  <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-2 mt-2 text-xs">
                  <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground capitalize">{selectedAsset.type}</span></div>
                  <div><span className="text-muted-foreground">Origin:</span> <span className="text-foreground">{selectedAsset.origin}</span></div>
                  <div><span className="text-muted-foreground">Spec:</span> <span className="font-mono text-foreground">{selectedAsset.meta}</span></div>
                  {selectedAsset.url && (
                    <div><span className="text-muted-foreground">URL:</span> <span className="font-mono text-primary text-[10px] break-all">{selectedAsset.url}</span></div>
                  )}
                </div>
                <div className="mt-auto space-y-2">
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-brass/40 text-brass text-sm hover:border-primary/40 hover:text-primary transition-colors">
                    <Download size={14} /> Download
                  </button>
                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 transition-all"
                    style={{ boxShadow: "0 0 12px hsl(43 72% 55% / 0.3)" }}
                  >
                    <Share2 size={14} /> Share Externally
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VaultView;
