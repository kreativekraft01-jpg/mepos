import { motion, PanInfo, useMotionValue, useTransform } from 'motion/react';
import { useState, ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeableItemProps {
  children: ReactNode;
  onDelete: () => void;
  className?: string;
  threshold?: number;
}

export function SwipeableItem({ children, onDelete, className = '', threshold = -100 }: SwipeableItemProps) {
  const x = useMotionValue(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Visual feedback transforms
  // As we pull left (negative x), we reveal the red background
  const opacity = useTransform(x, [-100, -20], [1, 0]);
  const scale = useTransform(x, [-100, -20], [1, 0.8]);
  const backgroundOpacity = useTransform(x, [-150, 0], [1, 0]);
  const iconTranslate = useTransform(x, [-200, -100], [20, 0]);

  const handleDragEnd = (_event: any, info: PanInfo) => {
    // Determine if the swipe was enough to trigger deletion
    // We check displacement (offset) or velocity (flick)
    const swipedFarEnough = info.offset.x < threshold;
    const swipedFastEnough = info.velocity.x < -500;

    if (swipedFarEnough || swipedFastEnough) {
      setIsDeleting(true);
      // Cleanly animate the item away before calling onDelete
      x.set(-1000);
      setTimeout(() => {
        onDelete();
      }, 200);
    } else {
      // Snap back to the original position
      x.set(0);
    }
  };

  return (
    <div 
      className={`relative overflow-hidden bg-muted ${className}`} 
      style={{ 
        touchAction: 'pan-y',
      }}
    >
      {/* Background Layer: Red Delete Zone */}
      <motion.div
        style={{ 
          opacity: backgroundOpacity,
        }}
        className="absolute inset-0 flex items-center justify-end pr-10 z-0 bg-destructive"
      >
        <motion.div
          style={{ opacity, scale, x: iconTranslate }}
          className="flex items-center gap-3 text-destructive-foreground"
        >
          <Trash2 className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-widest">Delete</span>
        </motion.div>
      </motion.div>

      {/* Foreground Layer: The Draggable Content */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -200, right: 0 }}
        dragElastic={{ left: 0.1, right: 0.01 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={isDeleting ? { x: -1000, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 40, 
          mass: 0.5 
        }}
        whileTap={{ cursor: 'grabbing' }}
        className="relative z-10 bg-card w-full h-full cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
