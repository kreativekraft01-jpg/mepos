import { ArrowRight, Wallet, X, Landmark, History } from 'lucide-react';
import { useState } from 'react';
import { CloseBanking } from './CloseBanking';
import { PerformOpenBanking } from './PerformOpenBanking';
import { motion } from 'motion/react';

interface OpenBankingProps {
  onComplete: (float: number, floatName: string) => void;
  onClose?: () => void;
}

const FLOAT_OPTIONS = [
  { 
    id: 1, 
    name: 'Float 1', 
    amount: 100, 
    userName: null,
    hasCash: true,
    isOpen: false,
    prevBankingOpen: false,
    dueAmount: 450.00,
    expectedAmount: 100.00
  },
  { 
    id: 2, 
    name: 'Float 2', 
    amount: 250, 
    userName: 'John Smith',
    hasCash: true,
    isOpen: true,
    prevBankingOpen: true,
    dueAmount: 1240.50,
    expectedAmount: 250.00
  },
  { 
    id: 3, 
    name: 'Float 3', 
    amount: 500, 
    userName: null,
    hasCash: false,
    isOpen: false,
    prevBankingOpen: false,
    dueAmount: 0,
    expectedAmount: 500.00
  },
  { 
    id: 4, 
    name: 'Float 4', 
    amount: 1000, 
    userName: null,
    hasCash: true,
    isOpen: true,
    prevBankingOpen: false,
    dueAmount: 890.25,
    expectedAmount: 1000.00
  },
  { 
    id: 5, 
    name: 'Float 5', 
    amount: 2000, 
    userName: 'Sarah Johnson',
    hasCash: true,
    isOpen: true,
    prevBankingOpen: false,
    dueAmount: 2150.00,
    expectedAmount: 2000.00
  },
];

export function OpenBanking({ onComplete, onClose }: OpenBankingProps) {
  const [selectedFloat, setSelectedFloat] = useState<typeof FLOAT_OPTIONS[0] | null>(null);
  const [showCloseBanking, setShowCloseBanking] = useState(false);
  const [showPerformOpenBanking, setShowPerformOpenBanking] = useState(false);

  const handleConfirm = () => {
    if (selectedFloat) {
      if (selectedFloat.prevBankingOpen) {
        setShowCloseBanking(true);
      } else if (!selectedFloat.isOpen) {
        setShowPerformOpenBanking(true);
      } else {
        onComplete(selectedFloat.amount, selectedFloat.name);
      }
    }
  };

  if (showCloseBanking && selectedFloat) {
    return (
      <CloseBanking 
        floatName={selectedFloat.name}
        dueAmount={selectedFloat.dueAmount}
        onClose={() => setShowCloseBanking(false)}
        onComplete={() => onComplete(selectedFloat.amount, selectedFloat.name)}
      />
    );
  }

  if (showPerformOpenBanking && selectedFloat) {
    return (
      <PerformOpenBanking 
        floatName={selectedFloat.name}
        expectedAmount={selectedFloat.expectedAmount || selectedFloat.amount}
        onClose={() => setShowPerformOpenBanking(false)}
        onComplete={(amount) => onComplete(amount, selectedFloat.name)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card max-w-2xl w-full p-6 shadow-2xl border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-left">
            <h1 className="text-2xl font-medium mb-1 text-foreground">Select Float</h1>
            <p className="text-sm text-muted-foreground">
              Select your starting float to begin your shift
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Float Options Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {FLOAT_OPTIONS.map((option) => {
            const isSelected = selectedFloat?.name === option.name;
            
            return (
              <button
                key={option.id}
                onClick={() => setSelectedFloat(option)}
                className={`p-5 rounded-xl border transition-all text-left group relative flex items-center gap-5 ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary'
                    : 'border-border hover:border-primary/50 bg-card hover:bg-muted active:bg-muted/80'
                }`}
              >
                {/* Float ID & Name */}
                
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-medium text-foreground leading-tight mb-1">{option.name}</div>
                  
                  {/* Context Text */}
                  {option.userName ? (
                    <div className="flex items-center gap-1.5 text-primary font-medium text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {option.userName}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Unassigned</div>
                  )}
                </div>

                {/* Status Icons Container */}
                <div className="flex flex-col gap-3 shrink-0 items-end">
                  <div className="flex gap-2">
                    {/* Cash Status Icon */}
                    <div 
                      className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                        option.hasCash 
                          ? 'text-emerald-500' 
                          : 'text-muted-foreground'
                      }`}
                      title={option.hasCash ? "Has Cash" : "Empty"}
                    >
                      <Wallet className="w-5 h-5" />
                    </div>

                    {/* Banking Status Icon */}
                    {option.isOpen && (
                      <div 
                        className={`p-2 rounded-lg flex items-center justify-center transition-colors ${
                          option.prevBankingOpen
                            ? 'text-amber-500 animate-pulse'
                            : 'text-blue-500'
                        }`}
                        title={option.prevBankingOpen ? "Previous Banking Not Closed" : "Banking Open"}
                      >
                        {option.prevBankingOpen ? <History className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          className={`w-full rounded-xl py-3.5 text-base font-semibold flex items-center justify-center gap-2.5 transition-colors shadow-lg ${
            selectedFloat 
              ? 'bg-primary text-primary-foreground hover:brightness-110' 
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
          disabled={!selectedFloat}
        >
          <span>
            {selectedFloat
              ? `Open ${selectedFloat.name}`
              : 'Select a Float to Continue'}
          </span>
          {selectedFloat && <ArrowRight className="w-5 h-5" />}
        </button>
      </motion.div>
    </div>
  );
}
