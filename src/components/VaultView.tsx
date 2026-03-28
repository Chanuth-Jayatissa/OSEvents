import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Film, Image, FileText, MapPin, Download, Share2, X, Play } from "lucide-react";
import Icosahedron from "./Icosahedron";

interface Asset {
  id: string;
  type: "video" | "image" | "document";
  title: string;
  origin: string;
  thumbnail: string;
  size: "large" | "medium" | "small";
  meta: string;
}

const assets: Asset[] = [
  { id: "1", type: "video", title: "Keynote Promo Reel", origin: "Video Renderer", thumbnail: "", size: "large", meta: "4K • 2:34 • MP4" },
  { id: "2", type: "image", title: "Stage Banner v3", origin: "Visual Designer", thumbnail: "", size: "medium", meta: "3840×2160 • PNG" },
  { id: "3", type: "image", title: "Speaker Card — Sarah Chen", origin: "Visual Designer", thumbnail: "", size: "medium", meta: "1080×1080 • PNG" },
  { id: "4", type: "document", title: "VIP Invitation Draft", origin: "Email Drafter", thumbnail: "", size: "small", meta: "DOCX • 2 pages" },
  { id: "5", type: "image", title: "Instagram Carousel Slide 1", origin: "Social Scheduler", thumbnail: "", size: "medium", meta: "1080×1350 • PNG" },
  { id: "6", type: "document", title: "Venue Contract Notes", origin: "Venue Coordinator", thumbnail: "", size: "small", meta: "PDF • 8 pages" },
  { id: "7", type: "video", title: "Sponsor Highlight Reel", origin: "Video Renderer", thumbnail: "", size: "large", meta: "1080p • 1:12 • MP4" },
  { id: "8", type: "image", title: "Event Logo Gold Variant", origin: "Brand Inspector", thumbnail: "", size: "small", meta: "512×512 • SVG" },
];

const categories = [
  { icon: Film, label: "Cinematics", count: 2 },
  { icon: Image, label: "Creatives", count: 4 },
  { icon: FileText, label: "Documents", count: 2 },
  { icon: MapPin, label: "Logistics", count: 0 },
];

const VaultView = () => {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getCardClass = (size: string) => {
    switch (size) {
      case "large": return "col-span-2 row-span-2";
      case "medium": return "col-span-1 row-span-1";
      case "small": return "col-span-1 row-span-1";
      default: return "";
    }
  };

  const getCardHeight = (size: string) => {
    switch (size) {
      case "large": return "h-64";
      case "medium": return "h-40";
      case "small": return "h-32";
      default: return "h-32";
    }
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
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-foreground hover:bg-primary/5 hover:text-primary transition-colors"
            >
              <cat.icon size={14} className="text-primary" />
              <span>{cat.label}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">{cat.count}</span>
            </button>
          ))}
        </div>

        <div>
          <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Origin Agent</h4>
          {["Video Renderer", "Visual Designer", "Email Drafter", "Brand Inspector"].map((agent) => (
            <label key={agent} className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              <input type="checkbox" className="w-3 h-3 rounded border-brass accent-gold" />
              {agent}
            </label>
          ))}
        </div>
      </div>

      {/* Main Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-3 auto-rows-min">
          {/* Ghost Card */}
          <motion.div
            className="col-span-1 row-span-1 h-40 border-2 border-dashed border-primary/30 rounded-lg flex flex-col items-center justify-center gap-3"
            animate={{ borderColor: ["hsl(43 72% 55% / 0.2)", "hsl(43 72% 55% / 0.5)", "hsl(43 72% 55% / 0.2)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Icosahedron size={28} spinning />
            <span className="text-[10px] font-mono text-primary/60">Creating asset...</span>
          </motion.div>

          {assets.map((asset) => (
            <motion.div
              key={asset.id}
              className={`${getCardClass(asset.size)} ${getCardHeight(asset.size)} relative rounded-lg overflow-hidden cursor-pointer group border transition-all ${
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
              {/* Placeholder bg */}
              <div className={`absolute inset-0 ${
                asset.type === "video" ? "bg-gradient-to-br from-onyx to-obsidian" :
                asset.type === "image" ? "bg-gradient-to-br from-muted to-onyx" :
                "bg-card"
              }`} />

              {/* Video play icon */}
              {asset.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                    <Play size={16} className="text-primary ml-0.5" />
                  </div>
                </div>
              )}

              {/* Meta overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-obsidian/90 to-transparent">
                <p className="text-xs font-medium text-foreground truncate">{asset.title}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{asset.meta}</p>
              </div>
            </motion.div>
          ))}
        </div>
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
              {/* Preview */}
              <div className="flex-1 bg-obsidian flex items-center justify-center">
                <div className="text-center">
                  {selectedAsset.type === "video" && <Film size={48} className="text-primary mx-auto mb-3" />}
                  {selectedAsset.type === "image" && <Image size={48} className="text-brass mx-auto mb-3" />}
                  {selectedAsset.type === "document" && <FileText size={48} className="text-foreground/40 mx-auto mb-3" />}
                  <p className="text-sm text-muted-foreground font-mono">{selectedAsset.title}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">{selectedAsset.meta}</p>
                </div>
              </div>

              {/* Actions sidebar */}
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
