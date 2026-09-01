import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Wallet, 
  CreditCard, 
  Ticket, 
  Bitcoin, 
  Terminal, 
  ShieldCheck, 
  Landmark, 
  ShoppingCart,
  Printer, 
  Check, 
  CheckCircle,
  Mail,
  UserPlus,
  Search,
  Lock
} from 'lucide-react';
import type { CustomerResult } from './SearchResults';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';

interface GiftVoucherPageProps {
  onBack: () => void;
  onActivateCustomerSearch: () => void;
  onNewCustomer: () => void;
  selectedCustomer: CustomerResult | null;
  onProcess: (details: any) => void;
}

export function GiftVoucherPage({ 
  onBack, 
  onActivateCustomerSearch, 
  onNewCustomer,
  selectedCustomer,
  onProcess 
}: GiftVoucherPageProps) {
  const [amount, setAmount] = useState<string>('');
  const [customerMode, setCustomerMode] = useState<'guest' | 'existing'>('guest');
  const [guestEmail, setGuestEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [pdq, setPdq] = useState('PDQ 1');
  const [receiptOptions, setReceiptOptions] = useState({
    print: true,
    email: false
  });
  const [isSuccess, setIsSuccess] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or when success modal is shown
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || isSuccess) {
        if (e.key === 'Escape' && isSuccess) {
          setIsSuccess(false);
        }
        return;
      }

      // Escape - Go back
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      // S - Search/Add Customer
      else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        onActivateCustomerSearch();
      }
      // U - New Customer
      else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        onNewCustomer();
      }
      // Enter - Process payment (if valid)
      else if (e.key === 'Enter' && parseFloat(amount) > 0) {
        e.preventDefault();
        handleProcess();
      }
      // P - Toggle print receipt
      else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setReceiptOptions(prev => ({ ...prev, print: !prev.print }));
      }
      // E - Toggle email receipt
      else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setReceiptOptions(prev => ({ ...prev, email: !prev.email }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [amount, isSuccess, onBack, onActivateCustomerSearch, onNewCustomer, receiptOptions]);

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

  const handleProcess = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (customerMode === 'guest' && !guestEmail) {
      toast.error('Please enter a guest email');
      return;
    }

    if (customerMode === 'existing' && !selectedCustomer) {
      toast.error('Please select a customer');
      return;
    }

    // Trigger Success
    setIsSuccess(true);
    toast.success('Payment processed successfully!');

    // Wait for animation before calling parent callback
    setTimeout(() => {
      onProcess({
        amount: parseFloat(amount),
        customer: customerMode === 'existing' ? selectedCustomer : { name: 'Guest', email: guestEmail },
        paymentMethod,
        pdq,
        receiptOptions
      });
    }, 3000);
  };

  const PaymentMethodCard = ({ id, label, icon: Icon }: any) => (
    <button
      onClick={() => setPaymentMethod(id)}
      className={`flex flex-col items-center justify-center p-2 border transition-all relative overflow-hidden group gap-1.5 h-full min-h-[4rem] ${
        paymentMethod === id 
          ? 'bg-primary border-primary text-black shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
          : 'bg-[#161A1E] border-[#2A2F34] text-neutral-400 hover:bg-[#20252b] hover:text-foreground'
      }`}
    >
      <Icon className={`w-5 h-5 ${paymentMethod === id ? 'text-black' : 'text-neutral-500 group-hover:text-foreground'}`} />
      <span className={`text-[9px] font-bold uppercase tracking-wider ${paymentMethod === id ? 'text-black' : 'text-foreground'} text-center leading-tight`}>
        {label}
      </span>
      
      {paymentMethod === id && (
        <div className="absolute top-1 right-1">
          <CheckCircle className="w-3 h-3 text-black" />
        </div>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#050505] animate-in fade-in slide-in-from-right-4 duration-300 overflow-hidden relative">
      
      {/* Success Overlay */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
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
                  £{parseFloat(amount).toFixed(2)}
                </motion.div>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-neutral-400 text-xs"
                >
                  Receipt sent to {customerMode === 'guest' ? guestEmail : selectedCustomer?.email}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-[#2A2F34] bg-[#0A0C0E] shrink-0">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-[#2A2F34] text-neutral-400 hover:text-foreground rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider">
            Gift Voucher
          </h1>
          <div className="h-5 w-px bg-[#2A2F34]" />
          <div className="text-xs text-neutral-400 font-mono">
            Issue New Voucher
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-hidden min-h-0">
        <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Details (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5 h-full min-h-0">
            
            {/* Amount Section */}
            <div className="bg-[#161A1E] border border-[#2A2F34] p-5 shrink-0">
              <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Voucher Value</h2>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-neutral-500">£</span>
                <input 
                  type="number"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 pl-10 bg-[#0A0C0E] border border-[#2A2F34] text-foreground text-2xl font-mono font-bold focus:border-primary focus:outline-none transition-colors placeholder:text-neutral-700"
                />
              </div>
            </div>

            {/* Combined Customer & Receipt Section - Flexible */}
            <div className="bg-[#161A1E] border border-[#2A2F34] flex-1 flex flex-col min-h-0 overflow-hidden">
               
               {/* Customer Part (Flexible) */}
               <div className="flex-1 flex flex-col min-h-0 p-5 overflow-hidden">
                   <div className="flex justify-between items-center mb-4 shrink-0">
                     <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Customer Details</h2>
                     <div className="flex bg-[#0A0C0E] p-1 border border-[#2A2F34]">
                        <button
                          onClick={() => setCustomerMode('guest')}
                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                            customerMode === 'guest' 
                              ? 'bg-[#2A2F34] text-foreground' 
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          Guest
                        </button>
                        <button
                          onClick={() => setCustomerMode('existing')}
                          className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                            customerMode === 'existing' 
                              ? 'bg-[#2A2F34] text-foreground' 
                              : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          Registered
                        </button>
                     </div>
                   </div>

                   <div className="overflow-y-auto min-h-0 flex flex-col justify-center">
                     {customerMode === 'guest' ? (
                       <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Guest Email</label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                              <input 
                                type="email"
                                value={guestEmail}
                                onChange={(e) => setGuestEmail(e.target.value)}
                                placeholder="customer@example.com"
                                className="w-full h-10 pl-10 pr-4 bg-[#0A0C0E] border border-[#2A2F34] text-foreground text-sm focus:border-primary focus:outline-none transition-colors"
                              />
                            </div>
                          </div>
                       </div>
                     ) : (
                       <div className="space-y-3 h-full flex flex-col">
                          {selectedCustomer ? (
                            <div className="bg-[#0A0C0E] border border-primary/30 p-4 flex items-center justify-between group mt-auto mb-auto">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary text-black flex items-center justify-center font-bold text-lg rounded-sm">
                                  {selectedCustomer.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-foreground text-sm">{selectedCustomer.name}</div>
                                  <div className="text-[10px] text-neutral-400">{selectedCustomer.email}</div>
                                </div>
                              </div>
                              <button 
                                onClick={onActivateCustomerSearch}
                                className="text-[10px] text-primary hover:text-primary/80 font-bold uppercase tracking-wider"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 h-full">
                              <button
                                onClick={onActivateCustomerSearch}
                                className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-[#2A2F34] hover:border-primary hover:bg-[#0A0C0E] transition-all group h-full"
                              >
                                <Search className="w-5 h-5 text-neutral-500 group-hover:text-primary" />
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider group-hover:text-foreground text-center">Search Customer</span>
                              </button>
                              
                              <button
                                onClick={onNewCustomer}
                                className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-[#2A2F34] hover:border-primary hover:bg-[#0A0C0E] transition-all group h-full"
                              >
                                <UserPlus className="w-5 h-5 text-neutral-500 group-hover:text-primary" />
                                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider group-hover:text-foreground text-center">Create New</span>
                              </button>
                            </div>
                          )}
                       </div>
                     )}
                   </div>
               </div>

               {/* Divider */}
               <div className="h-px bg-[#2A2F34] w-full shrink-0" />

               {/* Receipt Part (Fixed) */}
               <div className="p-5 shrink-0 bg-[#161A1E]">
                  <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Receipt & Delivery</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 bg-[#0A0C0E] border border-[#2A2F34] cursor-pointer hover:border-neutral-500 transition-colors">
                       <div className={`w-4 h-4 border flex items-center justify-center ${receiptOptions.print ? 'bg-primary border-primary' : 'border-neutral-600'}`}>
                          {receiptOptions.print && <Check className="w-3 h-3 text-black" />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden"
                         checked={receiptOptions.print}
                         onChange={(e) => setReceiptOptions(prev => ({ ...prev, print: e.target.checked }))}
                       />
                       <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                         <Printer className="w-3.5 h-3.5" /> Print Receipt
                       </span>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-[#0A0C0E] border border-[#2A2F34] cursor-pointer hover:border-neutral-500 transition-colors">
                       <div className={`w-4 h-4 border flex items-center justify-center ${receiptOptions.email ? 'bg-primary border-primary' : 'border-neutral-600'}`}>
                          {receiptOptions.email && <Check className="w-3 h-3 text-black" />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden"
                         checked={receiptOptions.email}
                         onChange={(e) => setReceiptOptions(prev => ({ ...prev, email: e.target.checked }))}
                       />
                       <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                         <Mail className="w-3.5 h-3.5" /> Email Receipt
                       </span>
                    </label>
                  </div>
               </div>
            </div>

          </div>

          {/* Right Column: Payment (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-[#161A1E] border border-[#2A2F34] overflow-hidden">
             
             <div className="p-5 flex-1 flex flex-col min-h-0">
                <h2 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Payment Method</h2>
                
                {/* 2 columns, flexible */}
                <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 mb-4 overflow-y-auto">
                  <PaymentMethodCard id="cash" label="Cash" icon={Wallet} />
                  <PaymentMethodCard id="card" label="Card" icon={CreditCard} />
                  <PaymentMethodCard id="voucher" label="Voucher" icon={Ticket} />
                  <PaymentMethodCard id="bitcoin" label="Bitcoin" icon={Bitcoin} />
                  <PaymentMethodCard id="datacash" label="Datacash" icon={Terminal} />
                  <PaymentMethodCard id="authorizenet" label="Authorize.Net" icon={ShieldCheck} />
                  <PaymentMethodCard id="lacaixa" label="LaCaixa" icon={Landmark} />
                  <PaymentMethodCard id="ebay" label="eBay" icon={ShoppingCart} />
                </div>

                {/* PDQ Selection */}
                <div className="shrink-0">
                   <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Select PDQ Terminal</label>
                   <select 
                     value={pdq}
                     onChange={(e) => setPdq(e.target.value)}
                     className="w-full h-10 px-3 bg-[#0A0C0E] border border-[#2A2F34] text-foreground text-sm focus:border-primary focus:outline-none transition-colors"
                   >
                     <option>PDQ 1</option>
                     <option>PDQ 2</option>
                     <option>PDQ 3</option>
                   </select>
                </div>
             </div>

             {/* Footer - Fixed */}
             <div className="p-5 border-t border-[#2A2F34] bg-[#161A1E] shrink-0 mt-auto">
                <button 
                  onClick={handleProcess}
                  disabled={!(customerMode === 'guest' ? guestEmail : selectedCustomer) || !amount || parseFloat(amount) <= 0}
                  className="w-full h-14 bg-primary hover:brightness-110 text-black font-bold uppercase tracking-wider text-base transition-colors shadow-lg flex items-center justify-between px-6 rounded-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Process Payment
                  </span>
                  <span className="font-mono text-xl bg-black/10 px-4 py-1 rounded">
                    £{amount ? parseFloat(amount).toFixed(2) : '0.00'}
                  </span>
                </button>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}