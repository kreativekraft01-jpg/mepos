import { Home, ShoppingCart, ChevronDown, MapPin, Zap, ArrowRight, ScanLine } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ScreenSaverProps {
  onNavigate: (target: 'home' | 'cart') => void;
  branchName: string;
}

export function ScreenSaver({ onNavigate, branchName }: ScreenSaverProps) {
  const [hovered, setHovered] = useState<'home' | 'cart' | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#050505] z-[100] flex flex-col items-center justify-center p-6 select-none overflow-hidden"
    >
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-[#DB7337]/10 blur-[150px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.05, 0.1, 0.05],
            rotate: [0, -5, 5, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
          className="absolute -bottom-[20%] -right-[10%] w-[80%] h-[80%] bg-[#DB7337]/10 blur-[150px] rounded-full" 
        />
        
        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center gap-16">
        {/* Logo / Branding */}
        <div className="text-center space-y-2">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-8xl font-black italic tracking-tighter text-white relative inline-block"
          >
            ME<span className="text-[#DB7337] drop-shadow-[0_0_25px_rgba(219,115,55,0.6)]">PoS</span>
            <motion.div 
              animate={{ width: ["0%", "100%"] }}
              transition={{ duration: 1.5, ease: "circOut", delay: 0.5 }}
              className="absolute -bottom-4 right-0 h-1.5 bg-[#DB7337]"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="flex items-center justify-center gap-3 text-neutral-400 font-mono text-sm tracking-widest uppercase px-[0px] py-[16px]"
          >
            <span>{branchName}</span>
            <span className="w-1 h-1 bg-[#DB7337] rounded-full" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </motion.div>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
          {/* Home Button */}
          <NavButton 
            icon={<Home className="w-10 h-10" />}
            label="HOME"
            subLabel="Launch Dashboard"
            color="#DB7337"
            onClick={() => onNavigate('home')}
            isHovered={hovered === 'home'}
            onHoverStart={() => setHovered('home')}
            onHoverEnd={() => setHovered(null)}
          />

          {/* Cart Button */}
          <NavButton 
            icon={<ShoppingCart className="w-10 h-10" />}
            label="CART"
            subLabel="New Transaction"
            color="#DB7337"
            onClick={() => onNavigate('cart')}
            isHovered={hovered === 'cart'}
            onHoverStart={() => setHovered('cart')}
            onHoverEnd={() => setHovered(null)}
          />
        </div>
      </div>

      {/* Interactive Hint */}
      <motion.div 
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <div className="w-px h-12 bg-gradient-to-b from-transparent via-neutral-600 to-transparent" />
        <span className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.3em]">
          System Ready
        </span>
      </motion.div>
    </motion.div>
  );
}

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  subLabel: string;
  color: string;
  onClick: () => void;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

function NavButton({ icon, label, subLabel, color, onClick, isHovered, onHoverStart, onHoverEnd }: NavButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative group h-64 w-full bg-[#0A0C0E] border border-[#2A2F34] overflow-hidden"
    >
      {/* Hover Background Gradient */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute inset-0 bg-gradient-to-br from-[#161A1E] to-transparent z-0"
      />
      
      {/* Animated Border Line */}
      <motion.div
        className="absolute top-0 left-0 w-full h-[2px] z-10"
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ backgroundColor: color }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-full h-[2px] z-10"
        initial={{ scaleX: 0, originX: 1 }}
        animate={{ scaleX: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ backgroundColor: color }}
      />
      <motion.div
        className="absolute top-0 right-0 w-[2px] h-full z-10"
        initial={{ scaleY: 0, originY: 0 }}
        animate={{ scaleY: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut", delay: 0.1 }}
        style={{ backgroundColor: color }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-[2px] h-full z-10"
        initial={{ scaleY: 0, originY: 1 }}
        animate={{ scaleY: isHovered ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut", delay: 0.1 }}
        style={{ backgroundColor: color }}
      />

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center gap-6">
        {/* Icon Container */}
        <div className="relative">
          <motion.div
            animate={{ 
              color: isHovered ? color : "#525252",
              scale: isHovered ? 1.1 : 1,
              filter: isHovered ? `drop-shadow(0 0 15px ${color}60)` : "drop-shadow(0 0 0 transparent)"
            }}
            transition={{ duration: 0.3 }}
          >
            {icon}
          </motion.div>
          
          
        </div>

        <div className="text-center space-y-2">
          <motion.div 
            className="text-4xl font-black tracking-tighter text-white"
            animate={{ y: isHovered ? -2 : 0 }}
          >
            {label}
          </motion.div>
          
          <div className="flex items-center justify-center gap-2 overflow-hidden h-6">
            <motion.div
              initial={{ y: 0 }}
              animate={{ y: isHovered ? -30 : 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              
              <span className="text-xs font-bold uppercase tracking-[0.2em] h-6 flex items-center gap-2" style={{ color }}>
                Enter <ArrowRight className="w-3 h-3" />
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Corner Accents */}
      <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-neutral-700 transition-colors duration-300 group-hover:border-white/50" />
      <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-neutral-700 transition-colors duration-300 group-hover:border-white/50" />
      <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-neutral-700 transition-colors duration-300 group-hover:border-white/50" />
      <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-neutral-700 transition-colors duration-300 group-hover:border-white/50" />
    </motion.button>
  );
}