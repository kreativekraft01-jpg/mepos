import { useState, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  Banknote, 
  Coins, 
  ArrowRight, 
  ChevronLeft,
  Trash2,
  Lock,
  Hash,
  AlertTriangle
} from 'lucide-react';

interface Denomination {
  label: string;
  value: number;
  type: 'note' | 'coin';
}

const DENOMINATIONS: Denomination[] = [
  { label: '£50.00', value: 50, type: 'note' },
  { label: '£20.00', value: 20, type: 'note' },
  { label: '£10.00', value: 10, type: 'note' },
  { label: '£5.00', value: 5, type: 'note' },
  { label: '£2.00', value: 2, type: 'coin' },
  { label: '£1.00', value: 1, type: 'coin' },
  { label: '50p', value: 0.5, type: 'coin' },
  { label: '20p', value: 0.2, type: 'coin' },
  { label: '10p', value: 0.1, type: 'coin' },
  { label: '5p', value: 0.05, type: 'coin' },
];

interface DenomRowProps {
  item: any;
  onUpdateCount: (label: string, delta: number) => void;
  onQtyChange: (label: string, value: string, denValue: number) => void;
  onSubtotalChange: (label: string, value: string, denValue: number) => void;
}

const DenomRow = ({ item, onUpdateCount, onQtyChange, onSubtotalChange }: DenomRowProps) => (
  <div className="grid grid-cols-12 px-4 py-3.5 items-center group hover:bg-muted/50 transition-colors border-b border-border last:border-0">
    <div className="col-span-3">
      <div className={`inline-flex items-center justify-center min-w-[60px] px-3 py-2 rounded-m font-bold text-sm ${
        item.type === 'note' ? 'text-green-500' : 'text-amber-500'
      }`}>
        {item.label}
      </div>
    </div>

    <div className="col-span-5 flex justify-center">
      <div className="flex items-center gap-1.5 bg-muted rounded-m p-1 border border-border">
        <button 
          onClick={() => onUpdateCount(item.label, -1)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-card shadow-sm hover:bg-muted/80 text-muted-foreground transition-all active:scale-90"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input 
          type="number" 
          value={item.count || ''}
          placeholder="0"
          onChange={(e) => onQtyChange(item.label, e.target.value, item.value)}
          className="w-12 text-center font-bold text-foreground bg-transparent border-none focus:ring-0 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button 
          onClick={() => onUpdateCount(item.label, 1)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-card shadow-sm hover:bg-muted/80 text-muted-foreground transition-all active:scale-90"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>

    <div className="col-span-4 flex justify-end">
      <div className="relative w-28">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">£</span>
        <input 
          type="number"
          step={item.value}
          value={item.total || ''}
          placeholder="0.00"
          onChange={(e) => onSubtotalChange(item.label, e.target.value, item.value)}
          className="w-full bg-muted/50 border border-border rounded-m py-2.5 pl-6 pr-3 font-bold text-foreground focus:ring-2 focus:ring-primary focus:bg-card transition-all text-sm text-right"
        />
      </div>
    </div>
  </div>
);

interface PerformOpenBankingProps {
  floatName: string;
  expectedAmount: number;
  onClose: () => void;
  onComplete: (amount: number) => void;
}

export function PerformOpenBanking({ floatName, expectedAmount, onClose, onComplete }: PerformOpenBankingProps) {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(DENOMINATIONS.map(d => [d.label, 0]))
  );
  const [bagSealNumber, setBagSealNumber] = useState('');
  const floatSealNumber = "FS-8829-X"; // Mock static value

  const cashBreakdown = useMemo(() => {
    return DENOMINATIONS.map(den => ({
      ...den,
      count: counts[den.label],
      total: den.value * counts[den.label]
    }));
  }, [counts]);

  const notes = useMemo(() => cashBreakdown.filter(item => item.type === 'note'), [cashBreakdown]);
  const coins = useMemo(() => cashBreakdown.filter(item => item.type === 'coin'), [cashBreakdown]);

  const totalAmount = useMemo(() => {
    return cashBreakdown.reduce((sum, item) => sum + item.total, 0);
  }, [cashBreakdown]);

  const isBalanced = Math.abs(totalAmount - expectedAmount) < 0.01;

  const updateCount = (label: string, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [label]: Math.max(0, prev[label] + delta)
    }));
  };

  const handleQtyChange = (label: string, value: string, denValue: number) => {
    const num = parseInt(value) || 0;
    setCounts(prev => ({
      ...prev,
      [label]: Math.max(0, num)
    }));
  };

  const handleSubtotalChange = (label: string, value: string, denValue: number) => {
    const subtotal = parseFloat(value) || 0;
    const qty = Math.floor(subtotal / denValue);
    setCounts(prev => ({
      ...prev,
      [label]: Math.max(0, qty)
    }));
  };

  const clearAll = () => {
    if (confirm('Clear all counts?')) {
      setCounts(Object.fromEntries(DENOMINATIONS.map(d => [d.label, 0])));
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-[60] overflow-hidden text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-2.5 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-m transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Open Banking ({floatName})</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Shift Commencement</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Expected</p>
            <p className="text-lg font-bold text-muted-foreground">£{expectedAmount.toFixed(2)}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="text-right">
            <p className="text-[9px] font-bold text-muted-foreground uppercase">Current Total</p>
            <p className={`text-lg font-bold ${isBalanced ? 'text-green-500' : 'text-blue-500'}`}>
              £{totalAmount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto h-full grid grid-cols-12 gap-6">
          
          {/* Main Workspace */}
          <div className="col-span-9 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Banknote className="w-4 h-4 text-muted-foreground" />
                Float Verification
              </h2>
              <button onClick={clearAll} className="text-[10px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> RESET
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
              {/* Notes Grid */}
              <div className="bg-card rounded-[4px] border border-border shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5 text-green-500" />
                    Notes
                  </span>
                  <span className="text-sm font-bold text-foreground">£{notes.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-12 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="col-span-3">Unit</div>
                    <div className="col-span-5 text-center">Qty</div>
                    <div className="col-span-4 text-right">Subtotal</div>
                  </div>
                  {notes.map(item => (
                    <DenomRow 
                      key={item.label} 
                      item={item} 
                      onUpdateCount={updateCount}
                      onQtyChange={handleQtyChange}
                      onSubtotalChange={handleSubtotalChange}
                    />
                  ))}
                  <div className="flex-1" />
                </div>
              </div>

              {/* Coins Grid */}
              <div className="bg-card rounded-[4px] border border-border shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    Coins
                  </span>
                  <span className="text-sm font-bold text-foreground">£{coins.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-12 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="col-span-3">Unit</div>
                    <div className="col-span-5 text-center">Qty</div>
                    <div className="col-span-4 text-right">Subtotal</div>
                  </div>
                  {coins.map(item => (
                    <DenomRow 
                      key={item.label} 
                      item={item} 
                      onUpdateCount={updateCount}
                      onQtyChange={handleQtyChange}
                      onSubtotalChange={handleSubtotalChange}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-span-3 flex flex-col space-y-4 overflow-hidden">
            {/* Security Section */}
            <section className="bg-card rounded-[4px] border border-border shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Security Check</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-m border border-border">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Float Seal Number</label>
                  <div className="flex items-center gap-2 text-foreground font-mono font-bold">
                    <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                    {floatSealNumber}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Bag Seal Number</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input 
                      type="text"
                      value={bagSealNumber}
                      onChange={(e) => setBagSealNumber(e.target.value)}
                      className="w-full bg-input border border-border rounded-m py-3 pl-9 pr-4 font-bold text-sm text-foreground focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground"
                      placeholder="Enter bag seal ID..."
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Reconciliation Status */}
            <section className="bg-muted/20 rounded-[4px] p-5 text-foreground border border-border shadow-xl flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-muted-foreground uppercase tracking-widest">Yesterday's Close</span>
                    <span className="font-bold text-[12px]">£{expectedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-muted-foreground uppercase tracking-widest">Counted Now</span>
                    <span className="font-bold text-[12px]">£{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Variance</span>
                    <span className={`text-sm font-bold ${isBalanced ? 'text-green-500' : 'text-amber-500'}`}>
                      £{(totalAmount - expectedAmount).toFixed(2)}
                    </span>
                  </div>
                </div>

                {!isBalanced && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-m flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[12px] text-amber-500 leading-relaxed font-regular">
                      Variance detected between system expected amount and your count. Please recount or provide reason on completion.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-6">
                <button 
                  disabled={!bagSealNumber}
                  onClick={() => onComplete(totalAmount)}
                  className={`w-full py-4 rounded-m font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                    !bagSealNumber 
                      ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
                  }`}
                >
                  Confirm & Open
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-[8px] text-center text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                  Confirming will initialize shift records
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

