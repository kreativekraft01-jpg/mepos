import { 
  UserPlus, 
  ShoppingBag, 
  FileText, 
  TestTube2, 
  RotateCcw, 
  Tag, 
  Printer, 
  Gift, 
  DollarSign, 
  Receipt, 
  Heart,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

interface HomePageProps {
  branchName: string;
  todaysFigures: {
    sales: number;
    buys: number;
    exchange: number;
    refunds: number;
  };
  onNewCustomer: () => void;
  onCurrentTransaction: () => void;
  onNewTransaction: () => void;
  onTestOrders: () => void;
  onRefund: (orderId: string) => void;
  onRelabel: () => void;
  onReprintReceipt: () => void;
  onGiftVoucher: () => void;
  onPriceRequest: () => void;
  onGiftReceipt: () => void;
  onDonate: () => void;
}

export function HomePage({
  branchName,
  todaysFigures,
  onNewCustomer,
  onCurrentTransaction,
  onNewTransaction,
  onTestOrders,
  onRefund,
  onRelabel,
  onReprintReceipt,
  onGiftVoucher,
  onPriceRequest,
  onGiftReceipt,
  onDonate,
}: HomePageProps) {
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState('');

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const quickActions = [
    { label: 'Test Orders', icon: TestTube2, action: onTestOrders },
    { label: 'Refund', icon: RotateCcw, action: () => setShowRefundModal(true) },
    { label: 'Relabel', icon: Tag, action: onRelabel },
    { label: 'Reprint Receipt', icon: Printer, action: onReprintReceipt },
    { label: 'Gift Voucher', icon: Gift, action: onGiftVoucher },
    { label: 'Price Request', icon: DollarSign, action: onPriceRequest },
    { label: 'Gift Receipt', icon: Receipt, action: onGiftReceipt },
    { label: 'Donate', icon: Heart, action: onDonate },
  ];

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (refundOrderId.trim()) {
      onRefund(refundOrderId);
      setShowRefundModal(false);
      setRefundOrderId('');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          if (showRefundModal) setShowRefundModal(false);
        }
        return;
      }

      // Close modal with Escape
      if (e.key === 'Escape' && showRefundModal) {
        setShowRefundModal(false);
        return;
      }

      // N - New Transaction
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        onNewTransaction();
      }
      // U - New User/Customer
      else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onNewCustomer();
      }
      // C - Current Transaction
      else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onCurrentTransaction();
      }
      // R - Refund
      else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setShowRefundModal(true);
      }
      // T - Test Orders
      else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        onTestOrders();
      }
      // G - Gift Voucher
      else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        onGiftVoucher();
      }
      // P - Price Request
      else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onPriceRequest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRefundModal, onNewTransaction, onNewCustomer, onCurrentTransaction, onTestOrders, onGiftVoucher, onPriceRequest]);

  return (
    <div className="flex-1 bg-background p-4 lg:p-6 overflow-hidden flex flex-col h-full relative">
      <AnimatePresence>
        {showRefundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRefundModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative bg-card w-full max-w-md border border-border shadow-2xl overflow-hidden"
            >
              <div className="bg-muted/40 px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-destructive animate-spin-slow" />
                  Find Order for Refund
                </h3>
                <button
                  onClick={() => setShowRefundModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors hover:rotate-90 duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleRefundSubmit} className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
                      Order Number
                    </label>
                    <input 
                      autoFocus
                      type="text"
                      className="w-full h-12 px-4 bg-background border border-border text-foreground text-lg font-mono focus:border-primary focus:outline-none transition-all focus:shadow-[0_0_0_1px_rgba(178,105,68,0.5)] placeholder:text-muted-foreground"
                      placeholder="e.g. ORD-2024-8821"
                      value={refundOrderId}
                      onChange={(e) => setRefundOrderId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRefundModal(false)}
                    className="px-4 py-2 border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-bold uppercase tracking-wider text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={!refundOrderId.trim()}
                    className="px-6 py-2 bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold uppercase tracking-wider text-xs transition-all shadow-[0_0_15px_rgba(219,115,55,0.1)] hover:shadow-[0_0_20px_rgba(219,115,55,0.3)]"
                  >
                    Find Order
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="flex-1 grid grid-cols-12 gap-6 min-h-0"
      >
        {/* Left Column: Header, Primary Actions, Figures - 8 cols */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 h-full min-h-0">
          
          {/* Header Area */}
          <motion.div variants={item} className="flex justify-between items-end border-b border-border pb-4 shrink-0">
             <div>
               <h1 className="text-3xl font-light tracking-tight text-foreground uppercase">{branchName}</h1>
               <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                 {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
               </div>
             </div>
          </motion.div>

          {/* Primary Actions Grid - Takes available space */}
          <div className="grid grid-cols-2 auto-rows-fr gap-4 flex-1 min-h-0">
             <motion.button
                variants={item}
                whileHover={{ scale: 1.01, boxShadow: "0 0 30px rgba(178,105,68,0.2)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onNewTransaction}
                className="col-span-2 lg:col-span-1 lg:row-span-2 group relative bg-primary text-primary-foreground p-[clamp(0.75rem,2.8vh,2rem)] flex flex-col items-start justify-between hover:brightness-110 transition-all rounded-[4px] overflow-hidden min-h-0 border border-transparent hover:border-primary-foreground/10"
              >
                <div className="absolute -right-12 -top-12 w-64 h-64 bg-black/5 rounded-full blur-3xl group-hover:bg-black/10 transition-colors duration-500" />
                
                <div className="absolute top-4 right-4 z-10">
                  <kbd className="px-2 py-1 bg-black/20 border border-primary-foreground/20 text-xs font-mono text-primary-foreground font-semibold shadow-sm">
                    N
                  </kbd>
                </div>
                
                <motion.div 
                  initial={{ rotate: 0 }}
                  whileHover={{ rotate: 5, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="p-2 lg:p-4 rounded-none mb-4 lg:mb-6 relative z-10"
                >
                  <FileText className="w-8 h-8 lg:w-10 lg:h-10" strokeWidth={1} />
                </motion.div>
                
                <div className="relative z-10 w-full">
                   <span className="text-[clamp(1.5rem,4vh,2.25rem)] font-light block mb-2 tracking-tight">New<br/>Transaction</span>
                   <div className="h-px w-12 bg-primary-foreground/50 mb-3 lg:mb-4 group-hover:w-24 transition-all duration-500" />
                   <span className="text-primary-foreground/70 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                     Start Sale <ArrowRight className="w-4 h-4" />
                   </span>
                </div>
             </motion.button>

              <motion.button
                variants={item}
                whileHover={{ scale: 1.02, backgroundColor: "var(--muted)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onNewCustomer}
                className="group relative bg-card border border-border p-[clamp(0.625rem,2vh,1.5rem)] flex flex-col items-start justify-between transition-all rounded-[4px] overflow-hidden min-h-0 hover:border-primary/50 hover:shadow-lg"
              >
                 <div className="absolute top-4 right-4">
                   <kbd className="px-2 py-1 bg-muted border border-border text-xs font-mono text-muted-foreground font-semibold shadow-sm">
                     U
                   </kbd>
                 </div>
                 
                  <motion.div 
                    whileHover={{ x: 5 }}
                    className="p-2 rounded-none mb-2 group-hover:text-primary transition-colors"
                  >
                    <UserPlus className="w-6 h-6" strokeWidth={1.5} />
                  </motion.div>
                 <div>
                   <span className="text-[clamp(1rem,2vh,1.125rem)] font-medium block">New Customer</span>
                   <span className="text-xs text-muted-foreground uppercase tracking-wider">Register & Details</span>
                 </div>
              </motion.button>

              <motion.button
                variants={item}
                whileHover={{ scale: 1.02, backgroundColor: "var(--muted)" }}
                whileTap={{ scale: 0.98 }}
                onClick={onCurrentTransaction}
                className="group relative bg-card border border-border p-[clamp(0.625rem,2vh,1.5rem)] flex flex-col items-start justify-between transition-all rounded-[4px] overflow-hidden min-h-0 hover:border-primary/50 hover:shadow-lg"
              >
                 <div className="absolute top-4 right-4">
                   <kbd className="px-2 py-1 bg-muted border border-border text-xs font-mono text-muted-foreground font-semibold shadow-sm">
                     C
                   </kbd>
                 </div>
                 
                  <motion.div 
                    whileHover={{ rotate: -10 }}
                    className="p-2 rounded-none mb-2 group-hover:text-primary transition-colors"
                  >
                    <ShoppingBag className="w-6 h-6" strokeWidth={1.5} />
                  </motion.div>
                 <div className="text-left">
                   <span className="text-[clamp(1rem,2vh,1.125rem)] font-medium block">Current Transaction</span>
                   <span className="text-xs text-muted-foreground uppercase tracking-wider">View & Edit Cart</span>
                 </div>
              </motion.button>
          </div>

          {/* Today's Figures - Footer style */}
          <motion.div variants={item} className="bg-card border border-border p-6 shrink-0 rounded-[4px] hover:border-border/80 transition-colors">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Today's Figures</h2>
            <div className="grid grid-cols-4 gap-8">
               {[
                 { label: 'Sales', value: todaysFigures.sales, color: 'text-[#10B981]' },
                 { label: 'Buys', value: todaysFigures.buys, color: 'text-[#8B5CF6]' },
                 { label: 'Exchange', value: todaysFigures.exchange, color: 'text-[#3B82F6]' },
                 { label: 'Refunds', value: -todaysFigures.refunds, color: 'text-[#EF4444]' }
               ].map((stat, idx) => (
                 <motion.div 
                    key={idx} 
                    className="space-y-1 cursor-default"
                    whileHover={{ y: -2 }}
                 >
                   <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{stat.label}</div>
                   <div className={`text-2xl font-light tracking-tight ${stat.color}`}>
                     £{stat.value.toFixed(2)}
                   </div>
                 </motion.div>
               ))}
            </div>
          </motion.div>

        </div>

        {/* Right Column: Quick Actions - 4 cols */}
        <motion.div variants={item} className="col-span-12 lg:col-span-4 flex flex-col h-full bg-card border border-border rounded-[4px] overflow-hidden">
          <div className="p-6 border-b border-border shrink-0 bg-muted/20">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary rounded-none animate-pulse" />
              Quick Actions
            </h2>
          </div>
          <div className="grid grid-cols-2 auto-rows-fr gap-px bg-border flex-1 overflow-y-auto"> 
             {quickActions.map((btn, idx) => (
               <motion.button 
                 key={idx}
                 onClick={btn.action}
                 whileHover={{ backgroundColor: "var(--muted)", scale: 0.98 }}
                 whileTap={{ scale: 0.95 }}
                 className="bg-card group flex flex-col items-center justify-center gap-3 p-4 transition-all hover:z-10 relative overflow-hidden"
               >
                  <motion.div
                    whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
                  >
                    <btn.icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.5} />
                  </motion.div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center text-[14px]">{btn.label}</span>
               </motion.button>
             ))}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}