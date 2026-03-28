import { motion } from "framer-motion";

interface IcosahedronProps {
  size?: number;
  spinning?: boolean;
  className?: string;
}

const Icosahedron = ({ size = 24, spinning = true, className = "" }: IcosahedronProps) => {
  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      animate={spinning ? { rotateY: 360, rotateX: 180 } : {}}
      transition={spinning ? { duration: 8, repeat: Infinity, ease: "linear" } : {}}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} className="drop-shadow-[0_0_6px_hsl(43,72%,55%,0.5)]">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(43, 72%, 65%)" />
            <stop offset="100%" stopColor="hsl(33, 35%, 42%)" />
          </linearGradient>
        </defs>
        {/* Simplified icosahedron wireframe */}
        <polygon points="50,5 90,35 75,85 25,85 10,35" fill="none" stroke="url(#goldGrad)" strokeWidth="1.5" opacity="0.8" />
        <polygon points="50,5 10,35 25,85" fill="none" stroke="url(#goldGrad)" strokeWidth="0.8" opacity="0.4" />
        <polygon points="50,5 90,35 75,85" fill="none" stroke="url(#goldGrad)" strokeWidth="0.8" opacity="0.4" />
        <line x1="10" y1="35" x2="90" y2="35" stroke="url(#goldGrad)" strokeWidth="0.8" opacity="0.3" />
        <line x1="25" y1="85" x2="75" y2="85" stroke="url(#goldGrad)" strokeWidth="0.8" opacity="0.3" />
        <circle cx="50" cy="50" r="3" fill="hsl(43, 72%, 55%)" opacity="0.6" />
      </svg>
    </motion.div>
  );
};

export default Icosahedron;
