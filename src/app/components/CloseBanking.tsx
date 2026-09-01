import { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Coins, 
  ArrowRight, 
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Wallet
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { tillExpectedCash } from '@/utils/format';
import { ConfirmDialog } from './ConfirmDialog';

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

const OTHER_METHODS = [
  { id: 'paypal_out', label: 'PayPal Out' },
  { id: 'fps', label: 'FPS' },
  { id: 'bitcoin', label: 'Bitcoin' },
  { id: 'bitcoin_out', label: 'Bitcoin Out' },
  { id: 'datacash', label: 'DataCash' },
  { id: 'datacash_refund', label: 'DataCash Refund' },
  { id: 'authorize_net', label: 'Authorize.net' },
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
      <div className={`inline-flex items-center justify-center min-w-[60px] px-3 py-2 font-bold text-sm ${
        item.type === 'note' ? 'text-green-500' : 'text-amber-500'
      }`}>
        {item.label}
      </div>
    </div>

    <div className="col-span-5 flex justify-center">
      <div className="flex items-center gap-1.5 bg-muted p-1 border border-border">
        <button 
          onClick={() => onUpdateCount(item.label, -1)}
          className="w-9 h-9 flex items-center justify-center bg-card shadow-sm hover:bg-muted text-muted-foreground transition-all active:scale-90"
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
          className="w-9 h-9 flex items-center justify-center bg-card shadow-sm hover:bg-muted text-muted-foreground transition-all active:scale-90"
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
          className="w-full bg-input border border-border py-2.5 pl-6 pr-3 font-bold text-foreground focus:ring-2 focus:ring-primary focus:bg-card transition-all text-sm text-right"
        />
      </div>
    </div>
  </div>
);

interface CloseBankingProps {
  floatName: string;
  dueAmount: number;
  onClose: () => void;
  onComplete: () => void;
}

export function CloseBanking({ floatName, dueAmount, onClose, onComplete }: CloseBankingProps) {
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(DENOMINATIONS.map(d => [d.label, 0]))
  );
  const [cardAmount, setCardAmount] = useState<string>('');
  const [cardRefunds, setCardRefunds] = useState<string>('');
  const [otherPayments, setOtherPayments] = useState<Record<string, string>>(
    Object.fromEntries(OTHER_METHODS.map(m => [m.id, '']))
  );
  const [isOtherExpanded, setIsOtherExpanded] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const sales = useStore((s) => s.sales);
  const tills = useStore((s) => s.tills);
  const settings = useStore((s) => s.settings);
  const setBankingContext = useStore((s) => s.setBankingContext);

  const cashBreakdown = useMemo(() => {
    return DENOMINATIONS.map(den => ({
      ...den,
      count: counts[den.label],
      total: den.value * counts[den.label]
    }));
  }, [counts]);

  const notes = useMemo(() => cashBreakdown.filter(item => item.type === 'note'), [cashBreakdown]);
  const coins = useMemo(() => cashBreakdown.filter(item => item.type === 'coin'), [cashBreakdown]);

  const totalCashDeclared = useMemo(() => {
    return cashBreakdown.reduce((sum, item) => sum + item.total, 0);
  }, [cashBreakdown]);

  const totalOther = useMemo(() => {
    return Object.values(otherPayments).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  }, [otherPayments]);

  const totalDeclared = totalCashDeclared + (parseFloat(cardAmount) || 0) - (parseFloat(cardRefunds) || 0) + totalOther;
  const variance = totalDeclared - dueAmount;
  const hasVariance = Math.abs(variance) >= 0.01;

  // Set banking context for the AI assistant
  useEffect(() => {
    const activeTill = tills.find((t) => t.status === 'open' && t.name === floatName)
    if (!activeTill) return

    setBankingContext({
      tillId: activeTill.id,
      tillName: activeTill.name,
      expectedCash: dueAmount,
      countedCash: totalDeclared,
      variance,
      openedAt: activeTill.openedAt ?? Date.now(),
      openingFloat: activeTill.openingFloat,
      currency: settings.currency
    })

    return () => setBankingContext(null)
  }, [tills, floatName, dueAmount, totalDeclared, variance, settings.currency, setBankingContext])

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

  const handleOtherChange = (id: string, value: string) => {
    setOtherPayments(prev => ({ ...prev, [id]: value }));
  };

  const clearAll = () => {
    setShowClearDialog(true);
  };

  const handleClearAll = () => {
    setCounts(Object.fromEntries(DENOMINATIONS.map(d => [d.label, 0])));
    setCardAmount('');
    setCardRefunds('');
    setOtherPayments(Object.fromEntries(OTHER_METHODS.map(m => [m.id, ''])));
    setShowClearDialog(false);
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col z-[60] overflow-hidden text-foreground">
      {/* Dynamic Header */}
      <div className="bg-card border-b border-border px-6 py-2.5 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[rgb(202,207,214)]">Close Banking <span>({floatName})</span> </h1> 
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider"> Monday, 26 January 2026</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[12px] font-bold text-muted-foreground uppercase">Target</p>
            <p className="text-lg font-bold text-[rgb(202,207,214)]">£{dueAmount.toFixed(2)}</p>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="text-right">
            <p className="text-[12px] font-bold text-muted-foreground uppercase">Declared</p>
            <p className={`text-lg font-bold ${hasVariance ? 'text-primary' : 'text-green-500'}`}>
              £{totalDeclared.toFixed(2)}
            </p>
          </div>
          {hasVariance ? (
             <div className="bg-destructive/10 px-3 py-1.5 border border-destructive/20 flex items-center gap-1.5">
               <AlertTriangle className="w-4 h-4 text-destructive" />
               <span className="text-xs font-bold text-destructive">£{variance.toFixed(2)} Var</span>
             </div>
          ) : (
            <div className="bg-green-500/10 px-3 py-1.5 border border-green-500/20 flex items-center gap-1.5">
               <CheckCircle2 className="w-4 h-4 text-green-500" />
               <span className="text-xs font-bold text-green-500">Balanced</span>
             </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto h-full grid grid-cols-12 gap-6">
          
          {/* Main Workspace (Notes & Coins Grids) */}
          <div className="col-span-9 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Banknote className="w-4 h-4 text-muted-foreground" />
                Cash Breakdown
              </h2>
              <button onClick={clearAll} className="text-[14px] font-bold text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> RESET ALL
              </button>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
              {/* Notes Grid */}
              <div className="bg-card border border-border shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Banknote className="w-3.5 h-3.5 text-green-500" />
                    Notes
                  </span>
                  <span className="text-sm font-bold text-[rgb(202,207,214)] text-[16px]">£{notes.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-12 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="col-span-3 text-[12px]">Unit</div>
                    <div className="col-span-5 text-center text-[12px]">Qty</div>
                    <div className="col-span-4 text-right text-[12px]">Subtotal</div>
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
              <div className="bg-card border border-border shadow-sm flex flex-col overflow-hidden">
                <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    Coins
                  </span>
                  <span className="text-sm font-bold text-[rgb(202,207,214)] text-[16px] text-[15px]">£{coins.reduce((s, i) => s + i.total, 0).toFixed(2)}</span>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div className="grid grid-cols-12 px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                    <div className="col-span-3 text-[12px]">Unit</div>
                    <div className="col-span-5 text-center text-[12px]">Qty</div>
                    <div className="col-span-4 text-right text-[12px]">Subtotal</div>
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

          {/* Right Sidebar - Digital & Summary */}
          <div className="col-span-3 flex flex-col space-y-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Card Payments */}
              <section className="bg-card border border-border shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Card Payments</h2>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase ml-1 font-normal">Takings</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">£</span>
                      <input 
                        type="number"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                        className="w-full bg-input border border-border py-2.5 pl-6 pr-3 font-bold text-base focus:ring-2 focus:ring-primary transition-all text-foreground"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-bold uppercase ml-1 text-destructive font-normal">Refunds</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">£</span>
                      <input 
                        type="number"
                        value={cardRefunds}
                        onChange={(e) => setCardRefunds(e.target.value)}
                        className="w-full bg-input border border-border py-2.5 pl-6 pr-3 font-bold text-base text-destructive focus:ring-2 focus:ring-destructive transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Collapsible Other Payment Methods */}
              <section className="bg-card border border-border shadow-sm overflow-hidden">
                <button 
                  onClick={() => setIsOtherExpanded(!isOtherExpanded)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-500" />
                    <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Other</h2>
                  </div>
                  {isOtherExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isOtherExpanded && (
                  <div className="px-5 pb-5 space-y-3 border-t border-border pt-3 animate-in slide-in-from-top-2">
                    {OTHER_METHODS.map((method) => (
                      <div key={method.id} className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase ml-1">{method.label}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-[10px]">£</span>
                          <input 
                            type="number"
                            value={otherPayments[method.id]}
                            onChange={(e) => handleOtherChange(method.id, e.target.value)}
                            className="w-full bg-input border border-border py-2 pl-6 pr-2 font-bold text-xs focus:ring-2 focus:ring-primary transition-all text-foreground"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Final Summary Card */}
            <section className="bg-card border border-border p-5 shadow-xl shrink-0 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-bold text-muted-foreground uppercase tracking-widest">Main Net</span>
                  <span className="font-bold text-foreground">£{(totalCashDeclared + (parseFloat(cardAmount) || 0) - (parseFloat(cardRefunds) || 0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[14px]">
                  <span className="font-bold text-muted-foreground uppercase tracking-widest">Others</span>
                  <span className="font-bold text-foreground">£{totalOther.toFixed(2)}</span>
                </div>
                
                <div className="h-px bg-border" />
                
                <div className="space-y-1">
                  <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">Total Declared</p>
                  <p className="text-3xl font-black tracking-tight text-foreground">£{totalDeclared.toFixed(2)}</p>
                  <p className={`text-[10px] font-bold ${hasVariance ? 'text-destructive' : 'text-green-500'} uppercase tracking-widest pt-1`}>
                    {hasVariance ? `£${variance.toFixed(2)} Variance` : 'Register Balanced'}
                  </p>
                </div>
              </div>

              <button 
                onClick={onComplete}
                className={`w-full py-4 font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                  hasVariance 
                    ? 'bg-primary text-primary-foreground hover:brightness-110' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                Close Banking
                <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          </div>
        </div>
      </div>

      {/* Reset Confirmation */}
      <ConfirmDialog
        isOpen={showClearDialog}
        title="Clear All Counts"
        message="Are you sure you want to clear all counts and inputs? This will reset every entry you have made."
        confirmLabel="Clear All"
        danger
        onCancel={() => setShowClearDialog(false)}
        onConfirm={handleClearAll}
      />
    </div>
  );
}
