import { Minus, Plus, Trash2, CreditCard } from 'lucide-react';
import { CartItem } from '@/app/types';
import { SwipeableItem } from './SwipeableItem';

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, change: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

export function Cart({ items, onUpdateQuantity, onRemoveItem, onCheckout }: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return (
    <div className="bg-neutral-50 rounded-lg border-2 border-neutral-300 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b-2 border-neutral-300 bg-white">
        <h2 className="text-2xl font-bold">Current Order</h2>
        <p className="text-base text-neutral-600 mt-1">{items.length} items</p>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-neutral-500 py-12">
            <p className="text-lg font-medium">No items in cart</p>
            <p className="text-sm mt-2">Add items to start an order</p>
          </div>
        ) : (
          items.map((item) => (
            <SwipeableItem 
              key={item.id} 
              onDelete={() => onRemoveItem(item.id)}
              className="shadow-sm border border-neutral-200"
            >
              <div
                className="bg-white p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="text-lg font-bold leading-tight text-neutral-900">{item.name}</div>
                    <div className="text-sm font-medium text-neutral-500 mt-1">
                      ${item.price.toFixed(2)} each
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </button>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 rounded-lg flex items-center justify-center transition-colors border border-neutral-300 shadow-sm"
                      title="Decrease quantity"
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <span className="text-xl font-bold w-12 text-center">{item.quantity}</span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 rounded-lg flex items-center justify-center transition-colors border border-neutral-300 shadow-sm"
                      title="Increase quantity"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="text-xl font-black text-neutral-900">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            </SwipeableItem>
          ))
        )}
      </div>


      {/* Totals */}
      <div className="px-6 py-4 border-t-2 border-neutral-300 bg-white space-y-2">
        <div className="flex justify-between text-lg text-neutral-600 font-medium">
          <span>Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg text-neutral-600 font-medium">
          <span>Tax (10%)</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-3xl font-black pt-2 border-t-2 border-neutral-300 text-neutral-900">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Checkout Button */}
      <div className="px-6 pb-6 bg-white">
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl py-5 text-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98]"
        >
          <CreditCard className="w-6 h-6" />
          Checkout - ${total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
