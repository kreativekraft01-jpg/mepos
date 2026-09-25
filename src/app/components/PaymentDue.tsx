import { X, Banknote, CreditCard, FileText, Ticket, Smartphone, Building2, Wallet, Gift, Star, DollarSign, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useSound } from '../hooks/useSound';
import type { PaymentMethod, PaymentSplit } from '../../types';

interface PaymentDueProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (payments: PaymentSplit[]) => void;
  total: number;
  sellTotal: number;
  buyTotal: number;
  exchangeTotal: number;
}

const paymentMethodsConfig = [
  { id: 'cash' as PaymentMethod, label: 'Cash', icon: Banknote, color: 'text-[#34D399]', bg: 'bg-[#34D399]/5', border: 'border-[#34D399]/10', activeBorder: 'border-[#34D399]' },
  { id: 'card' as PaymentMethod, label: 'Card', icon: CreditCard, color: 'text-[#60A5FA]', bg: 'bg-[#60A5FA]/5', border: 'border-[#60A5FA]/10', activeBorder: 'border-[#60A5FA]' },
  { id: 'voucher' as PaymentMethod, label: 'Voucher', icon: Ticket, color: 'text-[#FB923C]', bg: 'bg-[#FB923C]/5', border: 'border-[#FB923C]/10', activeBorder: 'border-[#FB923C]' },
  { id: 'cheque' as PaymentMethod, label: 'Cheque', icon: FileText, color: 'text-[#94A3B8]', bg: 'bg-[#94A3B8]/5', border: 'border-[#94A3B8]/10', activeBorder: 'border-[#94A3B8]' },
  { id: 'upi' as PaymentMethod, label: 'UPI', icon: Smartphone, color: 'text-[#A78BFA]', bg: 'bg-[#A78BFA]/5', border: 'border-[#A78BFA]/10', activeBorder: 'border-[#A78BFA]' },
  { id: 'bank_transfer' as PaymentMethod, label: 'Bank Transfer', icon: Building2, color: 'text-[#818CF8]', bg: 'bg-[#818CF8]/5', border: 'border-[#818CF8]/10', activeBorder: 'border-[#818CF8]' },
  { id: 'gift_card' as PaymentMethod, label: 'Gift Card', icon: Gift, color: 'text-[#FB7185]', bg: 'bg-[#FB7185]/5', border: 'border-[#FB7185]/10', activeBorder: 'border-[#FB7185]' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Distribute a target amount across a set of methods. Reduces proportionally when shrinking, splits evenly when growing. */
const distributeTarget = (
  methods: PaymentMethod[],
  targetRaw: number,
  current: (m: PaymentMethod) => number
): Partial<Record<PaymentMethod, number>> => {
  const target = Math.max(0, round2(targetRaw));
  const out: Partial<Record<PaymentMethod, number>> = {};
  if (methods.length === 0) return out;

  const curSum = methods.reduce((s, m) => s + current(m), 0);
  const shares = methods.map((m) => {
    const cur = current(m);
    if (curSum > 0 && target < curSum) {
      // shrinking: reduce proportionally
      return Math.floor(target * (cur / curSum) * 100) / 100;
    }
    if (curSum > 0) {
      // growing: keep current amounts, add the surplus evenly
      const surplus = target - curSum;
      return Math.floor((cur + surplus / methods.length) * 100) / 100;
    }
    // starting from zero: split evenly
    return Math.floor((target / methods.length) * 100) / 100;
  });

  let assigned = shares.reduce((s, v) => s + v, 0);
  let remainder = Math.round((target - assigned) * 100);
  for (let i = 0; remainder > 0 && i < shares.length; i++) {
    shares[i] = round2(shares[i] + 0.01);
    remainder -= 1;
  }

  methods.forEach((m, i) => (out[m] = shares[i]));
  return out;
};

export function PaymentDue({
  isOpen,
  onClose,
  onComplete,
  total,
  sellTotal,
  buyTotal,
  exchangeTotal,
}: PaymentDueProps) {
  const [selectedMethods, setSelectedMethods] = useState<PaymentMethod[]>([]);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethod, string>>({} as Record<PaymentMethod, string>);
  const [emailReceipt, setEmailReceipt] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(true);
  const [giftReceipt, setGiftReceipt] = useState(false);
  const [selectedPDQ, setSelectedPDQ] = useState('pdq1');
  const [sourceOfSale, setSourceOfSale] = useState('in-store');
  const [isSuccess, setIsSuccess] = useState(false);
  const { playSuccess } = useSound();

  // Reset state when opening with no selection
  useEffect(() => {
    if (isOpen && selectedMethods.length === 0) {
      // Default to cash if nothing selected? Or wait for user.
      // Leaving empty as per design to let user choose.
    }
  }, [isOpen]);

  // Trigger confetti when success state is active
  useEffect(() => {
    if (isSuccess) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const random = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isSuccess]);

  // Calculate totals — handle both PAY (customer → us) and PAYOUT (us → customer)
  const isPayout = total < -0.005;
  const absTotal = Math.abs(total);
  const payoutDue = isPayout ? absTotal : 0;
  const effectiveTotal = isPayout ? absTotal : Math.max(0, total);
  const totalPaid = selectedMethods.reduce((sum, method) => {
    const amount = parseFloat(paymentAmounts[method] || '0');
    return sum + amount;
  }, 0);
  
  const remaining = isPayout ? Math.max(0, payoutDue - totalPaid) : Math.max(0, total - totalPaid);
  const change = !isPayout && totalPaid > total ? totalPaid - total : 0;
  // For payout, customer is owed money — we must cover payoutDue; for sale, customer must cover total; balanced (0) is always payable
  const isFullyPaid = isPayout ? totalPaid >= payoutDue - 0.001 : total === 0 ? true : totalPaid >= total - 0.001;
  
  const amountOf = (m: PaymentMethod) => parseFloat(paymentAmounts[m] || '0') || 0;

  const handleMethodToggle = (method: PaymentMethod) => {
    if (isSuccess) return;

    if (selectedMethods.includes(method)) {
      const removedAmount = amountOf(method);
      const rest = selectedMethods.filter((m) => m !== method);
      const newAmounts = { ...paymentAmounts };
      delete newAmounts[method];

      // Redistribute the removed amount across the remaining methods so the total is preserved
      if (rest.length > 0 && removedAmount > 0) {
        const totalForRest = rest.reduce((s, m) => s + amountOf(m), 0) + removedAmount;
        const split = distributeTarget(rest, totalForRest, (m) => amountOf(m));
        rest.forEach((m) => (newAmounts[m] = (split[m] ?? 0).toFixed(2)));
      }

      setSelectedMethods(rest);
      setPaymentAmounts(newAmounts);
      return;
    }

    if (selectedMethods.length >= 3) return;

    // Auto-allocate the remaining amount to the newly added method
    const currentTotal = Object.values(paymentAmounts).reduce((sum, amt) => sum + parseFloat(amt || '0'), 0);
    const remainingAmount = Math.max(0, effectiveTotal - currentTotal);

    setSelectedMethods([...selectedMethods, method]);
    setPaymentAmounts({
      ...paymentAmounts,
      [method]: remainingAmount.toFixed(2)
    });
  };

  const isSelected = (method: PaymentMethod) => selectedMethods.includes(method);

  const handleAmountChange = (method: PaymentMethod, value: string) => {
    const raw = parseFloat(value);
    if (!Number.isFinite(raw)) {
      // Partial input (empty, ".", "-"): keep the text as-is without rebalancing
      setPaymentAmounts({ ...paymentAmounts, [method]: value });
      return;
    }

    const next = Math.max(0, raw);
    const others = selectedMethods.filter((m) => m !== method);
    const maxTotal = effectiveTotal;
    if (others.length === 0) {
      setPaymentAmounts({ ...paymentAmounts, [method]: value });
      return;
    }

    // Rebalance the other methods against the typed value, keeping the typed text as-is
    const clamped = Math.min(next, maxTotal);
    const split = distributeTarget(others, maxTotal - clamped, (m) => amountOf(m));
    setPaymentAmounts({
      ...paymentAmounts,
      [method]: value,
      ...Object.fromEntries(Object.entries(split).map(([m, v]) => [m, (v ?? 0).toFixed(2)]))
    });
  };

  const handleCompleteTransaction = () => {
    if (!isFullyPaid) return;
    
    // Trigger Success Animation
    setIsSuccess(true);
    playSuccess();
    toast.success('Payment processed successfully!');
    
    console.log('Transaction completed:', {
      total,
      paymentMethods: selectedMethods,
      amounts: paymentAmounts,
      change,
      receipt: { email: emailReceipt, print: printReceipt, gift: giftReceipt },
      pdq: selectedPDQ,
      source: sourceOfSale,
    });
    
    // Delay closing to show animation
    setTimeout(() => {
      setIsSuccess(false); // Reset for next time
      const maxTotal = effectiveTotal;
      const payments = selectedMethods.map((m) => ({
        method: m as PaymentMethod,
        amount: Math.round(Math.min(amountOf(m), maxTotal) * 100) / 100,
      }));
      onComplete?.(payments);
      onClose();
    }, 3000);
  };

  // Keyboard shortcuts for payment modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Enter - Process payment
      if (e.key === 'Enter' && isFullyPaid && !isSuccess) {
        e.preventDefault();
        handleCompleteTransaction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullyPaid, isSuccess]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.3
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Success Overlay - High Z-Index to cover modal */}
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-[#161A1E] border border-primary/50 p-8 rounded-lg flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] max-w-sm w-full mx-4"
              >
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="w-20 h-20 rounded-full bg-primary flex items-center justify-center relative z-10"
                  >
                    <Check className="w-10 h-10 text-black stroke-[3]" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 bg-primary/30 rounded-full z-0"
                  />
                </div>
                
                <div className="text-center space-y-2">
                  <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-black text-white uppercase tracking-wider"
                  >
                    Payment Successful
                  </motion.h2>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-primary font-mono text-3xl font-bold"
                  >
                    £{totalPaid.toFixed(2)}
                  </motion.div>
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-neutral-400 text-xs"
                  >
                    Change Due: £{change.toFixed(2)}
                  </motion.p>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Backdrop - Invisible to show cart content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-transparent z-[100]"
            onClick={!isSuccess ? onClose : undefined}
          />
            
          {/* Side Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-background border-l border-border shadow-2xl z-[101] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border px-[24px] py-[12px]">
              <h2 className="text-xl font-bold text-foreground uppercase tracking-wider">Payment Due</h2>
              <button
                onClick={onClose}
                disabled={isSuccess}
                className="p-2 hover:bg-card text-neutral-400 hover:text-foreground transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Scroll Area */}
            <div className="flex-1 overflow-y-auto">
              
              {/* Payment Methods - Horizontal Scroll */}
              <div className="p-6">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Select Method (Max 3)</h3>
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="flex overflow-x-auto gap-3 pb-[16px] -mx-6 px-[24px] no-scrollbar touch-pan-x pt-[8px] pr-[24px] pl-[24px] py-[8px]"
                >
                  {paymentMethodsConfig.map((method) => {
                    const selected = isSelected(method.id);
                    const Icon = method.icon;
                    
                    return (
                      <motion.button
                        key={method.id}
                        variants={itemVariants}
                        onClick={() => handleMethodToggle(method.id)}
                        disabled={(!selected && selectedMethods.length >= 3) || isSuccess}
                        className={`
                          flex-shrink-0 w-28 h-28 flex flex-col items-center justify-center gap-3 border-2 transition-all
                          ${selected 
                            ? `${method.bg} ${method.activeBorder} shadow-[0_0_20px_rgba(0,0,0,0.5)] scale-105` 
                            : `bg-card border-transparent hover:border-border opacity-80 hover:opacity-100`
                          }
                          ${(!selected && selectedMethods.length >= 3) || isSuccess ? 'opacity-30 cursor-not-allowed' : ''}
                        `}
                      >
                        <Icon className={`w-8 h-8 ${selected ? method.color : 'text-neutral-400'}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${selected ? 'text-foreground' : 'text-neutral-400'}`}>
                          {method.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </div>

              {/* Allocation Section */}
              {selectedMethods.length > 0 && (
                <div className="px-6 pb-6">
                  <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Allocation</h3>
                  <div className="space-y-3">
                    {selectedMethods.map((method) => {
                      const config = paymentMethodsConfig.find(m => m.id === method)!;
                      const Icon = config.icon;
                      
                      return (
                        <div key={method} className="flex items-center gap-3 bg-card p-1 pr-4 border border-border">
                          <div className={`p-3 ${config.bg} border-r border-border`}>
                            <Icon className={`w-5 h-5 ${config.color}`} />
                          </div>
                          <div className="flex-1 font-medium text-sm text-neutral-300">{config.label}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500">£</span>
                            <div className="flex items-center bg-background border border-border">
                              <button
                                onClick={() => {
                                  const current = amountOf(method);
                                  const newVal = Math.max(0, current - 1);
                                  handleAmountChange(method, newVal.toFixed(2));
                                }}
                                disabled={isSuccess}
                                className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-primary hover:bg-card transition-colors border-r border-border disabled:opacity-50"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                              </button>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={isSuccess}
                                value={paymentAmounts[method] || ''}
                                onChange={(e) => handleAmountChange(method, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const delta = e.key === 'ArrowUp' ? 1 : -1;
                                    handleAmountChange(method, Math.max(0, amountOf(method) + delta).toFixed(2));
                                  }
                                }}
                                onBlur={() => {
                                  const n = parseFloat(paymentAmounts[method] || '');
                                  if (!Number.isFinite(n)) {
                                    handleAmountChange(method, '0');
                                  } else {
                                    handleAmountChange(method, Math.min(n, effectiveTotal).toFixed(2));
                                  }
                                }}
                                className="w-20 bg-transparent text-center font-semibold text-[#F1F5F9] focus:outline-none placeholder:text-neutral-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
                                placeholder="0.00"
                              />
                              <button
                                onClick={() => {
                                  const current = amountOf(method);
                                  const newVal = current + 1;
                                  handleAmountChange(method, newVal.toFixed(2));
                                }}
                                disabled={isSuccess}
                                className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-primary hover:bg-card transition-colors border-l border-border disabled:opacity-50"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Area */}
            <div className="bg-card border-t border-border space-y-6 pt-[18px] pr-[24px] pb-[24px] pl-[24px]">
              
              {/* Receipt Options */}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${printReceipt ? 'bg-primary border-primary' : 'border-neutral-600 group-hover:border-primary'}`}>
                    {printReceipt && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium text-neutral-300 group-hover:text-foreground transition-colors">Print</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${emailReceipt ? 'bg-primary border-primary' : 'border-neutral-600 group-hover:border-primary'}`}>
                    {emailReceipt && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium text-neutral-300 group-hover:text-foreground transition-colors">Email</span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer group flex-1">
                  <div className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${giftReceipt ? 'bg-primary border-primary' : 'border-neutral-600 group-hover:border-primary'}`}>
                    {giftReceipt && <Check className="w-3.5 h-3.5 text-black" strokeWidth={3} />}
                  </div>
                  <span className="text-sm font-medium text-neutral-300 group-hover:text-foreground transition-colors">Gift</span>
                </label>
              </div>

              {/* Dropdowns Row */}
              <div className={`grid gap-4 ${selectedMethods.includes('card') ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {selectedMethods.includes('card') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">PDQ Terminal</label>
                    <div className="relative">
                      <select
                        disabled={isSuccess}
                        value={selectedPDQ}
                        onChange={(e) => setSelectedPDQ(e.target.value)}
                        className="w-full bg-card border border-border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary disabled:opacity-50 appearance-none"
                      >
                        <option value="pdq1">Terminal 1</option>
                        <option value="pdq2">Terminal 2</option>
                        <option value="pdq3">Terminal 3</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Source</label>
                  <div className="relative">
                    <select
                      disabled={isSuccess}
                      value={sourceOfSale}
                      onChange={(e) => setSourceOfSale(e.target.value)}
                      className="w-full bg-card border border-border text-foreground text-sm p-2.5 pr-10 focus:outline-none focus:border-primary disabled:opacity-50 appearance-none"
                    >
                      <option value="in-store">In Store</option>
                      <option value="online">Online</option>
                      <option value="phone">Phone</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Primary CTA & Totals Integrated */}
              <div className="space-y-3 mt-4">
                {/* Combined Total/Balance and Action Button */}
                <div className="flex items-stretch gap-0 h-24 shadow-lg shadow-black/20 overflow-hidden border border-border">
                  {/* Total/Balance Details */}
                  <div className="flex-1 bg-card p-4 flex flex-col justify-center gap-2 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">{isPayout ? 'Payout' : 'Total'}</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">£{(isPayout ? absTotal : total).toFixed(2)}</span>
                    </div>
                    {totalPaid > 0 && (
                      <div className="flex items-baseline justify-between gap-2 opacity-60">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">{isPayout ? 'We Pay' : 'Paid'}</span>
                        <span className="text-xs font-bold text-muted-foreground tabular-nums">£{totalPaid.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex-shrink-0">
                        {remaining > 0 ? (isPayout ? 'To Pay Customer' : 'To Pay') : change > 0 ? 'Change' : 'Balance'}
                      </span>
                      <span className={`text-2xl font-bold tabular-nums ${
                        remaining > 0 ? 'text-primary' : change > 0 ? 'text-[#34D399]' : 'text-[#34D399]'
                      }`}>
                        £{remaining > 0 ? remaining.toFixed(2) : change > 0 ? change.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    disabled={!isFullyPaid || isSuccess}
                    onClick={handleCompleteTransaction}
                    className="flex-[1.2] bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-bold uppercase tracking-wider text-lg transition-all active:scale-[0.99] flex flex-col items-center justify-center gap-2 leading-none disabled:shadow-none border-l-2 border-primary-foreground/10"
                  >
                    <span className="text-xl">{isPayout ? 'Pay Out' : 'Process'}</span>
                    {isFullyPaid && !isSuccess && (
                      <kbd className="px-2.5 py-1 bg-black/20 border border-primary-foreground/20 text-xs font-mono text-primary-foreground font-semibold shadow-sm">
                        Enter
                      </kbd>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}