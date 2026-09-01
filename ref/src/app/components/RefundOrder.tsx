import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, AlertCircle, Check, DollarSign, 
  RotateCcw, FileText, ChevronDown, CheckCircle,
  Gamepad2, Disc, Package, X
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  name: string;
  category: string;
  originalPrice: number;
  currentPrice: number;
  condition: string;
  icon?: any;
}

interface Order {
  id: string;
  date: string;
  items: OrderItem[];
}

const MOCK_ORDER: Order = {
  id: 'ORD-2024-8821',
  date: '2024-02-01 14:30',
  items: [
    {
      id: '1',
      name: 'PlayStation 5 Console Disc Edition',
      category: 'Gaming / Consoles',
      originalPrice: 449.00,
      currentPrice: 380.00,
      condition: 'Boxed',
      icon: Gamepad2
    },
    {
      id: '2',
      name: 'DualSense Wireless Controller - White',
      category: 'Gaming / Accessories',
      originalPrice: 59.99,
      currentPrice: 45.00,
      condition: 'New',
      icon: Gamepad2
    },
    {
      id: '3',
      name: 'Marvel\'s Spider-Man 2',
      category: 'Gaming / Software',
      originalPrice: 69.99,
      currentPrice: 55.00,
      condition: 'Used',
      icon: Disc
    }
  ]
};

const REASONS = [
  { 
    id: '48hr', 
    label: '48 Hour Return', 
    subReasons: ['Changed my mind', 'Unwanted Gift', 'Found Cheaper'] 
  },
  { 
    id: 'faulty', 
    label: 'Faulty / Defective', 
    subReasons: ['Does not power on', 'Disk drive failure', 'Overheating', 'Controller drift'] 
  },
  { 
    id: 'error', 
    label: 'Staff Error', 
    subReasons: ['Wrong item sold', 'Incorrect grade', 'Pricing error'] 
  }
];

interface RefundState {
  isSelected: boolean;
  reason: string;
  subReason: string;
  explanation: string;
  method: 'original' | 'current' | 'custom';
  customAmount: string;
}

interface RefundOrderProps {
  orderId: string;
  onBack: () => void;
  onProceed: (details: any) => void;
}

export function RefundOrder({ orderId, onBack, onProceed }: RefundOrderProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({});
  const [showReasonDropdown, setShowReasonDropdown] = useState<string | null>(null);
  
  const order = useMemo(() => MOCK_ORDER, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or when dropdowns are open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || showReasonDropdown) {
        if (e.key === 'Escape' && showReasonDropdown) {
          setShowReasonDropdown(null);
        }
        return;
      }

      // Escape - Go back
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      // Ctrl+A - Select all items
      else if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
        e.preventDefault();
        if (selectedItems.length === order.items.length) {
          setSelectedItems([]);
        } else {
          setSelectedItems(order.items.map(item => item.id));
        }
      }
      // Enter - Proceed (if items selected)
      else if (e.key === 'Enter' && selectedItems.length > 0) {
        const allItemsHaveReasons = selectedItems.every(id => refundReasons[id]);
        if (allItemsHaveReasons) {
          e.preventDefault();
          handleProceed();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, refundReasons, order.items, showReasonDropdown, onBack]);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const updateRefundReason = (itemId: string, reason: string) => {
    setRefundReasons(prev => ({
      ...prev,
      [itemId]: reason
    }));
  };

  const getItemRefundAmount = (itemId: string) => {
    const item = order.items.find(i => i.id === itemId);
    const refund = refundReasons[itemId];
    if (!item || !refund) return 0;
    
    if (refund === 'original') return item.originalPrice;
    if (refund === 'current') return item.currentPrice;
    if (refund === 'custom') return parseFloat(refundReasons[itemId]) || 0;
    return 0;
  };

  const totalRefundAmount = useMemo(() => {
    return Object.keys(refundReasons)
      .filter(id => selectedItems.includes(id))
      .reduce((sum, id) => sum + getItemRefundAmount(id), 0);
  }, [refundReasons, selectedItems]);

  const isValid = () => {
    const selectedIds = Object.keys(refundReasons).filter(id => selectedItems.includes(id));
    if (selectedIds.length === 0) return false;
    
    // Check if all selected items have valid reasons
    return selectedIds.every(id => {
      const r = refundReasons[id];
      if (!r) return false;
      if (r === 'custom' && (!refundReasons[id] || parseFloat(refundReasons[id]) <= 0)) return false;
      return true;
    });
  };

  const handleProceed = () => {
    if (!isValid()) {
      toast.error('Please complete details for all selected items');
      return;
    }
    
    onProceed({
      orderId,
      amount: totalRefundAmount,
      items: refundReasons
    });
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300 relative">
      
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card shrink-0">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-foreground uppercase tracking-wider flex items-center gap-3">
            Process Refund
          </h1>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
            <span>Order #{orderId}</span>
            <span className="w-1 h-1 bg-neutral-600 rounded-full" />
            <span>{order.items.length} Items Available</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 h-full">
        
        {/* Left Column: Item List (4 cols) */}
        <div className="col-span-12 lg:col-span-5 border-r border-border flex flex-col bg-card">
          <div className="p-4 border-b border-border bg-muted">
             <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Select Items to Refund</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {order.items.map(item => {
              const isActive = selectedItems.includes(item.id);
              const isComplete = isActive && refundReasons[item.id];
              
              return (
                <div 
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`relative p-3 border rounded-lg cursor-pointer transition-all group ${
                    isActive 
                      ? 'bg-secondary border-primary ring-1 ring-primary/20' 
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex gap-3">
                    {/* Checkbox */}
                    <div 
                      className={`w-5 h-5 mt-1 border rounded flex items-center justify-center transition-colors shrink-0 z-10 ${
                        isActive 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'bg-input border-border hover:border-primary'
                      }`}
                    >
                      {isActive && <Check className="w-3.5 h-3.5" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                         <span className={`text-m font-medium truncate ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                           {item.name}
                         </span>
                         <span className="text-xs font-mono font-bold text-foreground shrink-0 text-[14px]">
                           £{item.originalPrice.toFixed(2)}
                         </span>
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-1 uppercase tracking-wide">
                        {item.category}
                      </div>
                      
                      {isActive && (
                        <div className="mt-2 flex items-center gap-2">
                           <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded">
                             REFUNDING: £{getItemRefundAmount(item.id).toFixed(2)}
                           </span>
                           {isComplete ? (
                             <CheckCircle className="w-3 h-3 text-emerald-500" />
                           ) : (
                             <AlertCircle className="w-3 h-3 text-amber-500" />
                           )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Item Details (8 cols) */}
        <div className="col-span-12 lg:col-span-7 bg-background flex flex-col min-h-0 overflow-y-auto h-full overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedItems[0] || 'none'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col min-h-full"
            >
              {/* Config Header */}
              <div className="p-6 border-b border-border flex items-center gap-4 bg-card shrink-0 sticky top-0 z-20">
             
             <div>
                <h2 className="text-lg font-bold text-foreground font-normal">{selectedItems.length > 0 ? order.items.find(i => i.id === selectedItems[0])?.name : 'Select an Item'}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase font-bold">{selectedItems.length > 0 ? order.items.find(i => i.id === selectedItems[0])?.condition : ''}</span>
                  <span>Original Price: <span className="text-foreground font-mono">{selectedItems.length > 0 ? `£${order.items.find(i => i.id === selectedItems[0])?.originalPrice.toFixed(2)}` : ''}</span></span>
                </div>
             </div>
             

          </div>

          <div className={`p-6 flex-1 transition-opacity duration-200 ${selectedItems.length > 0 ? 'opacity-100' : 'opacity-50 pointer-events-none grayscale'}`}>
            
            {/* 1. Refund Method Grid */}
            <div className="mb-8">
               <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                 <DollarSign className="w-4 h-4 text-primary" />
                 Refund Amount
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1: Original */}
                  <label className={`flex flex-col justify-between p-4 border cursor-pointer transition-all rounded-sm ${refundReasons[selectedItems[0]] === 'original' ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/50'}`}>
                     <div className="flex items-center gap-3 mb-2">
                        <input 
                          type="radio" 
                          name={`method-${selectedItems[0]}`}
                          checked={refundReasons[selectedItems[0]] === 'original'}
                          onChange={() => updateRefundReason(selectedItems[0], 'original')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold text-foreground text-sm font-normal">Full Refund</span>
                     </div>
                     <div className="text-lg font-bold text-primary font-mono pl-7">{selectedItems.length > 0 ? `£${order.items.find(i => i.id === selectedItems[0])?.originalPrice.toFixed(2)}` : ''}</div>
                  </label>

                  {/* Option 2: Current */}
                  <label className={`flex flex-col justify-between p-4 border cursor-pointer transition-all rounded-sm ${refundReasons[selectedItems[0]] === 'current' ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/50'}`}>
                     <div className="flex items-center gap-3 mb-2">
                        <input 
                          type="radio" 
                          name={`method-${selectedItems[0]}`}
                          checked={refundReasons[selectedItems[0]] === 'current'}
                          onChange={() => updateRefundReason(selectedItems[0], 'current')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold text-foreground text-sm font-normal">Market Value</span>
                     </div>
                     <div className="text-lg font-bold text-primary font-mono pl-7">{selectedItems.length > 0 ? `£${order.items.find(i => i.id === selectedItems[0])?.currentPrice.toFixed(2)}` : ''}</div>
                  </label>

                  {/* Option 3: Custom */}
                  <label className={`flex flex-col justify-between p-4 border cursor-pointer transition-all rounded-sm ${refundReasons[selectedItems[0]] === 'custom' ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:border-primary/50'}`}>
                     <div className="flex items-center gap-3 mb-2">
                        <input 
                          type="radio" 
                          name={`method-${selectedItems[0]}`}
                          checked={refundReasons[selectedItems[0]] === 'custom'}
                          onChange={() => updateRefundReason(selectedItems[0], 'custom')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-bold text-foreground text-sm font-normal">Custom</span>
                     </div>
                     <div className="pl-7">
                        <input
                          type="number"
                          disabled={refundReasons[selectedItems[0]] !== 'custom'}
                          value={refundReasons[selectedItems[0]] === 'custom' ? refundReasons[selectedItems[0]] || '' : ''}
                          onChange={(e) => updateRefundReason(selectedItems[0], e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-input border border-border h-8 px-2 text-foreground font-mono text-sm focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
                        />
                     </div>
                  </label>
               </div>
            </div>

            {/* 2. Reasons & Details */}
            <div className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Refund Reason <span className="text-primary">*</span></label>
                    <div className="relative">
                      <select
                        value={refundReasons[selectedItems[0]] || ''}
                        onChange={(e) => {
                           updateRefundReason(selectedItems[0], e.target.value);
                        }}
                        className="w-full h-10 px-3 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" disabled>Select a reason</option>
                        {REASONS.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none w-4 h-4" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Sub-Reason <span className="text-primary">*</span></label>
                    <div className="relative">
                      <select
                        value={refundReasons[selectedItems[0]] || ''}
                        onChange={(e) => updateRefundReason(selectedItems[0], e.target.value)}
                        disabled={!refundReasons[selectedItems[0]]}
                        className="w-full h-10 px-3 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="" disabled>Select details</option>
                        {refundReasons[selectedItems[0]] && REASONS.find(r => r.id === refundReasons[selectedItems[0]])?.subReasons.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none w-4 h-4" />
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    Notes
                  </h3>
                  <div className="h-full">
                     <textarea
                       value={refundReasons[selectedItems[0]] || ''}
                       onChange={(e) => updateRefundReason(selectedItems[0], e.target.value)}
                       placeholder="Additional comments about item condition..."
                       className="w-full h-20 p-3 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors resize-none placeholder:text-neutral-600"
                     />
                  </div>
               </div>
            </div>

          </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Fixed Bottom Bar CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between gap-6 max-w-[1920px] mx-auto">
           <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
               <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Selected Items</div>
               <div className="text-sm font-medium text-foreground">
                  {selectedItems.length} items ready
               </div>
             </div>
           </div>
           
           <button 
             onClick={handleProceed}
             disabled={!isValid()}
             className="flex-1 max-w-full md:max-w-md lg:max-w-lg h-14 bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground font-bold uppercase tracking-wider text-base transition-all shadow-lg disabled:shadow-none flex items-center justify-between px-6 rounded-sm hover:scale-[1.01] active:scale-[0.99]"
           >
             <span>Proceed to Refund</span>
             <span className="font-mono text-xl bg-black/10 px-4 py-1 rounded">£{totalRefundAmount.toFixed(2)}</span>
           </button>
        </div>
      </div>
    </div>
  );
}