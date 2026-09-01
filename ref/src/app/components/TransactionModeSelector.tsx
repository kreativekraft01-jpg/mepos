import { motion } from 'motion/react';

interface TransactionModeSelectorProps {
  selectedMode: 'sell' | 'buy' | 'exchange';
  onSelectMode: (mode: 'sell' | 'buy' | 'exchange') => void;
  isReadOnly?: boolean;
}

export function TransactionModeSelector({
  selectedMode,
  onSelectMode,
  isReadOnly = false,
}: TransactionModeSelectorProps) {
  const modes = [
    { id: 'sell' as const, label: 'Sell', bg: 'bg-[#34D399]', activeClass: 'bg-[#34D399] text-black', textClass: 'text-[#34D399]' },
    { id: 'buy' as const, label: 'Buy', bg: 'bg-[#A78BFA]', activeClass: 'bg-[#A78BFA] text-black', textClass: 'text-[#A78BFA]' },
    { id: 'exchange' as const, label: 'Exchange', bg: 'bg-[#60A5FA]', activeClass: 'bg-[#60A5FA] text-black', textClass: 'text-[#60A5FA]' },
  ];

  const currentMode = modes.find(m => m.id === selectedMode);

  // Read-only mode - just show the selected mode as text
  if (isReadOnly && currentMode) {
    return (
      <div className={`inline-flex items-center px-4 py-2.5 ${currentMode.activeClass} rounded-none font-semibold text-base shadow-lg`}>
        {currentMode.label}
      </div>
    );
  }

  return (
    <div className="inline-flex bg-muted rounded-[4px] p-1 gap-1 border border-border">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onSelectMode(mode.id)}
          className={`relative px-8 py-2.5 rounded-sm font-black uppercase font-semibold transition-colors duration-200 z-10 ${
            selectedMode === mode.id
              ? 'text-black'
              : 'text-muted-foreground hover:text-foreground hover:bg-card'
          }`}
        >
          {selectedMode === mode.id && (
            <motion.div
              layoutId="activeTab"
              className={`absolute inset-0 rounded-sm ${mode.bg}`}
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              style={{ zIndex: -1 }}
            />
          )}
          {mode.label}
        </button>
      ))}
    </div>
  );
}
