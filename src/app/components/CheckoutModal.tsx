import { CreditCard, Banknote, Check } from 'lucide-react';
import { useState } from 'react';

interface CheckoutModalProps {
  total: number;
  onComplete: (paymentMethod: string) => void;
  onCancel: () => void;
}

export function CheckoutModal({ total, onComplete, onCancel }: CheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const paymentMethods = [
    { id: 'card', name: 'Card', icon: CreditCard },
    { id: 'cash', name: 'Cash', icon: Banknote },
  ];

  const handleComplete = () => {
    if (selectedMethod) {
      onComplete(selectedMethod);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-none max-w-lg w-full p-8 border border-border shadow-2xl">
        <h2 className="text-3xl mb-2 text-foreground font-light">Complete Payment</h2>
        <p className="text-xl text-muted-foreground mb-6">Total: £{total.toFixed(2)}</p>

        {/* Payment Methods */}
        <div className="space-y-3 mb-8">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full p-6 rounded-none border-2 flex items-center gap-4 transition-all ${
                  selectedMethod === method.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
              >
                <Icon className={`w-8 h-8 ${selectedMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xl flex-1 text-left ${selectedMethod === method.id ? 'text-foreground' : 'text-muted-foreground'}`}>{method.name}</span>
                {selectedMethod === method.id && (
                  <Check className="w-6 h-6 text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border-2 border-border hover:bg-muted rounded-none text-lg transition-colors text-muted-foreground hover:text-foreground font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={!selectedMethod}
            className="flex-1 px-6 py-4 bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground rounded-none text-lg transition-colors font-bold shadow-lg shadow-primary/20"
          >
            Complete
          </button>
        </div>
      </div>
    </div>
  );
}
