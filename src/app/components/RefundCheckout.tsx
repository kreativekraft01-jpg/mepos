import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Wallet, CreditCard, Ticket, 
  Printer, Mail, Lock, CheckCircle, Check,
  FileText, Globe, Bitcoin, Terminal, Utensils
} from 'lucide-react';
import { toast } from 'sonner';

interface RefundCheckoutProps {
  refundDetails: {
    amount: number;
    reason: string;
    subReason: string;
    orderId: string;
  };
  onBack: () => void;
  onProcess: (method: string, receiptOptions: { print: boolean; email: boolean }) => void;
}

export function RefundCheckout({ refundDetails, onBack, onProcess }: RefundCheckoutProps) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptOptions, setReceiptOptions] = useState({
    print: true,
    email: false
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Escape - Go back
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      // C - Cash payment
      else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setPaymentMethod('cash');
      }
      // B - Bank transfer
      else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setPaymentMethod('bank');
      }
      // V - Voucher
      else if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setPaymentMethod('voucher');
      }
      // Enter - Process refund
      else if (e.key === 'Enter') {
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
  }, [paymentMethod, receiptOptions, onBack]);

  const handleProcess = () => {
    onProcess(paymentMethod, receiptOptions);
  };

  const onPaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
  };

  const PaymentMethodCard = ({ id, label, icon: Icon, description }: any) => (
    <button
      onClick={() => onPaymentMethodChange(id)}
      className={`flex items-center gap-4 p-4 border-2 transition-all group ${
        paymentMethod === id ? 'bg-primary/10 border-primary' : 'border-border hover:border-primary/50 hover:bg-muted'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
         paymentMethod === id ? 'bg-card text-primary' : 'bg-input text-muted-foreground group-hover:text-foreground'
      }`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-left">
         <div className={`font-bold uppercase tracking-wider text-xs ${paymentMethod === id ? 'text-foreground' : 'text-foreground'}`}>{label}</div>
         {description && (
           <div className={`text-[10px] truncate max-w-[180px] ${paymentMethod === id ? 'text-muted-foreground' : 'text-muted-foreground'}`}>{description}</div>
         )}
      </div>
      
      {paymentMethod === id && (
        <div className="z-10 bg-primary rounded-full p-1 shrink-0 ml-auto">
          <CheckCircle className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b border-border bg-card">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-xl font-black text-foreground uppercase tracking-wider">
            Refund Checkout
          </h1>
          <div className="text-sm text-muted-foreground font-mono mt-1">
            Order #{refundDetails.orderId}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex justify-center">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left: Amount Summary & Receipt */}
          <div className="space-y-8">
             <div className="bg-card border border-border p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-2">Total Refund Due</h2>
                <div className="text-6xl font-black text-primary font-mono tracking-tight my-4">
                  £{refundDetails.amount.toFixed(2)}
                </div>
                <div className="inline-block bg-muted px-4 py-1.5 rounded-full text-xs font-bold text-foreground uppercase tracking-wider">
                   {refundDetails.reason}
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Printer className="w-4 h-4 text-primary" />
                  Receipt Options
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-4 p-4 bg-card border border-border cursor-pointer hover:bg-muted transition-colors group">
                     <div className={`w-6 h-6 border-2 flex items-center justify-center transition-colors ${receiptOptions.print ? 'bg-primary border-primary' : 'border-muted-foreground group-hover:border-foreground'}`}>
                        {receiptOptions.print && <Check className="w-4 h-4 text-primary-foreground" />}
                     </div>
                    
                     <input 
                       type="checkbox" 
                       className="hidden"
                       checked={receiptOptions.print}
                       onChange={(e) => setReceiptOptions(prev => ({ ...prev, print: e.target.checked }))}
                     />
                     <span className="font-bold text-foreground uppercase tracking-wide text-xs">Print Receipt</span>
                  </label>

                  <label className="flex items-center gap-4 p-4 bg-card border border-border cursor-pointer hover:bg-muted transition-colors group">
                     <div className={`w-6 h-6 border-2 flex items-center justify-center transition-colors ${receiptOptions.email ? 'bg-primary border-primary' : 'border-muted-foreground group-hover:border-foreground'}`}>
                        {receiptOptions.email && <CheckCircle className="w-4 h-4 text-primary-foreground" />}
                     </div>
                     <input 
                       type="checkbox" 
                       className="hidden"
                       checked={receiptOptions.email}
                       onChange={(e) => setReceiptOptions(prev => ({ ...prev, email: e.target.checked }))}
                     />
                     <span className="font-bold text-foreground uppercase tracking-wide text-xs">Email Receipt</span>
                  </label>
                </div>
             </div>
             
             {/* Action Button moved here for better mobile flow on small screens, or keep on right? Keep on right. */}
          </div>

          {/* Right: Payment Methods Grid */}
          <div className="flex flex-col h-full">
             <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
               <Wallet className="w-4 h-4 text-primary" />
               Refund Method
             </h3>
             
             <div className="grid grid-cols-2 gap-3 flex-1 content-start">
                <PaymentMethodCard 
                  id="cash" 
                  label="Cash" 
                  description="From Till" 
                  icon={Wallet} 
                />
                <PaymentMethodCard 
                  id="voucher" 
                  label="Voucher" 
                  description="Store Credit" 
                  icon={Ticket} 
                />
                <PaymentMethodCard 
                  id="card" 
                  label="Card" 
                  description="Original Card" 
                  icon={CreditCard} 
                />
                <PaymentMethodCard 
                  id="cheque" 
                  label="Cheque" 
                  description="Issue Cheque" 
                  icon={FileText} 
                />
                <PaymentMethodCard 
                  id="paypal" 
                  label="PayPal" 
                  description="Online Refund" 
                  icon={Globe} 
                />
                <PaymentMethodCard 
                  id="bitcoin" 
                  label="Bitcoin" 
                  description="Crypto Wallet" 
                  icon={Bitcoin} 
                />
                <PaymentMethodCard 
                  id="datacash" 
                  label="Datacash" 
                  description="Gateway Refund" 
                  icon={Terminal} 
                />
                <PaymentMethodCard 
                  id="justeat" 
                  label="Just Eat" 
                  description="Partner Refund" 
                  icon={Utensils} 
                />
             </div>

             <div className="mt-8 pt-6 border-t border-border">
                <button 
                  onClick={handleProcess}
                  className="w-full h-16 bg-primary hover:brightness-110 text-primary-foreground font-black uppercase tracking-wider text-base transition-colors shadow-[0_0_30px_rgba(204,117,73,0.3)] flex items-center justify-center gap-3"
                >
                   <Lock className="w-5 h-5" />
                   Process Refund
                </button>
                <div className="text-center mt-3 text-xs text-muted-foreground font-medium">
                   Manager authorisation required
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}