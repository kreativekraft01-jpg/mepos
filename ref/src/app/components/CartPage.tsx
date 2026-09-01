import { Save, Layers, TestTube2, Trash2, UserPlus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { TransactionModeSelector } from './TransactionModeSelector';
import { ProductTable } from './ProductTable';
import { SerialNumberModal } from './SerialNumberModal';
import { PaymentDue } from './PaymentDue';
import type { TransactionItem } from '../types';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { CustomerResult } from './SearchResults';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../hooks/useSound';

interface CartPageProps {
  onBack: () => void;
  onActivateCustomerSearch: () => void;
  initialItems?: TransactionItem[];
  pendingCartItem?: TransactionItem | null;
  setPendingCartItem?: (item: TransactionItem | null) => void;
  selectedCustomer?: CustomerResult | null;
  onAttachCustomer?: (customer: CustomerResult) => void;
  onTransactionComplete?: () => void;
}

export function CartPage({ onBack, onActivateCustomerSearch, initialItems = [], pendingCartItem, setPendingCartItem, selectedCustomer, onAttachCustomer, onTransactionComplete }: CartPageProps) {
  const [transactionMode, setTransactionMode] = useState<'sell' | 'buy' | 'exchange'>('sell');
  const [customerAdded, setCustomerAdded] = useState(false);
  const [items, setItems] = useState<TransactionItem[]>(initialItems);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [serialModalItem, setSerialModalItem] = useState<TransactionItem | null>(null);
  const [showPaymentDue, setShowPaymentDue] = useState(false);

  const { playBeep } = useSound();
  const prevCustomerRef = useRef(selectedCustomer);

  // Handle pending cart item from search
  useEffect(() => {
    if (pendingCartItem && setPendingCartItem) {
      playBeep();
      // Generate a unique ID to avoid duplicate keys
      const itemWithUniqueId = {
        ...pendingCartItem,
        id: `${pendingCartItem.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };
      setItems((prev) => [...prev, itemWithUniqueId]);
      setPendingCartItem(null);
    }
  }, [pendingCartItem, setPendingCartItem, playBeep]);

  // Handle selected customer
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerAdded(true);
      if (selectedCustomer !== prevCustomerRef.current) {
        playBeep();
      }
    }
    prevCustomerRef.current = selectedCustomer;
  }, [selectedCustomer, playBeep]);

  // Handle transaction mode change - update all items
  const handleTransactionModeChange = (mode: 'sell' | 'buy' | 'exchange') => {
    setTransactionMode(mode);
    setItems((prev) => prev.map((item) => ({ ...item, type: mode })));
  };

  // Calculate breakdown by transaction type
  const sellTotal = items
    .filter((item) => item.type === 'sell')
    .reduce((sum, item) => sum + item.price * item.qty, 0);
  
  const buyTotal = items
    .filter((item) => item.type === 'buy')
    .reduce((sum, item) => sum + item.price * item.qty, 0);
  
  const exchangeTotal = items
    .filter((item) => item.type === 'exchange')
    .reduce((sum, item) => sum + item.price * item.qty, 0);

  // Calculate IN (buy + exchange items coming in) and OUT (sell + exchange items going out)
  const inCount = items
    .filter((item) => item.type === 'buy' || item.type === 'exchange')
    .reduce((sum, item) => sum + item.qty, 0);
  
  const outCount = items
    .filter((item) => item.type === 'sell' || item.type === 'exchange')
    .reduce((sum, item) => sum + item.qty, 0);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.2; // 20% VAT
  const total = subtotal + tax;

  // Check if any items are missing serial numbers
  const hasPendingSerialNumbers = items.some(
    (item) => item.requiresSerial && !item.serialNumber
  );

  // Toggle item selection
  const handleToggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle all items
  const handleToggleAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map((item) => item.id));
    }
  };

  // Change item type
  const handleChangeType = (id: string, type: 'sell' | 'buy' | 'exchange') => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, type } : item))
    );
  };

  // Change item price
  const handleChangePrice = (id: string, price: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, price } : item))
    );
  };

  // Change item quantity
  const handleChangeQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item))
    );
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedItems((prev) => prev.filter((i) => i !== id));
  };

  // Add serial number
  const handleAddSerialNumber = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) {
      setSerialModalItem(item);
    }
  };

  // Save serial number
  const handleSaveSerialNumber = (serialNumber: string) => {
    if (serialModalItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === serialModalItem.id ? { ...item, serialNumber } : item
        )
      );
      setSerialModalItem(null);
    }
  };

  // Delete all items
  const handleDeleteAll = () => {
    if (window.confirm('Are you sure you want to delete all items?')) {
      setItems([]);
      setSelectedItems([]);
    }
  };

  // Delete selected items
  const handleDeleteSelected = () => {
    if (selectedItems.length > 0) {
      if (window.confirm(`Delete ${selectedItems.length} selected item(s)?`)) {
        setItems((prev) => prev.filter((item) => !selectedItems.includes(item.id)));
        setSelectedItems([]);
      }
    }
  };

  // Determine CTA state and text
  const getCTAState = () => {
    if (items.length === 0) {
      return { disabled: true, text: 'No Items' };
    }
    if (hasPendingSerialNumbers) {
      return { disabled: true, text: 'Serial Number Pending' };
    }
    if (!customerAdded) {
      return { disabled: true, text: 'Customer Not Selected' };
    }
    return { disabled: false, text: `WE OWE: £${total.toFixed(2)}` };
  };

  const ctaState = getCTAState();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or when payment modal is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || showPaymentDue) {
        if (e.key === 'Escape' && showPaymentDue) {
          setShowPaymentDue(false);
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
      // U - Add New Customer
      else if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        // Trigger new customer action if available
      }
      // Enter - Proceed to payment (if not disabled)
      else if (e.key === 'Enter' && !ctaState.disabled) {
        e.preventDefault();
        setShowPaymentDue(true);
      }
      // Delete - Remove selected items
      else if (e.key === 'Delete' && selectedItems.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // A - Toggle all items
      else if (e.key.toLowerCase() === 'a' && e.ctrlKey) {
        e.preventDefault();
        handleToggleAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPaymentDue, onBack, onActivateCustomerSearch, ctaState.disabled, selectedItems, handleDeleteSelected, handleToggleAll]);

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden transition-all duration-300 relative">
      <div 
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${showPaymentDue ? 'mr-[36rem]' : ''}`}
      >
        {/* Transaction Mode Selector & Utility Row */}
        <div className="bg-background px-6 py-4 border-b border-border/10">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Transaction Mode + Utilities */}
            <div className="flex items-center gap-4">
              <TransactionModeSelector
                selectedMode={transactionMode}
                onSelectMode={handleTransactionModeChange}
                isReadOnly={showPaymentDue}
              />

              {!showPaymentDue && items.length > 0 && (
                <>
                  <div className="h-8 w-px bg-border" />

                  {/* Utility Actions */}
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-3 bg-card hover:bg-muted border border-border rounded-none transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Save transaction</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-3 bg-card hover:bg-muted border border-border rounded-none transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Layers className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Tidy Row</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="p-3 bg-card hover:bg-muted border border-border rounded-none transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <TestTube2 className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Test Order</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Delete button - converts between "Delete All" and "Delete Selected" */}
                    {selectedItems.length > 0 ? (
                      <button
                        onClick={handleDeleteSelected}
                        className="px-4 py-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-none flex items-center gap-2 text-sm transition-colors shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete {selectedItems.length}
                      </button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={handleDeleteAll}
                            className="p-3 bg-card hover:bg-muted border border-border rounded-none transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>Delete All</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: Add Customer */}
            <AnimatePresence mode="wait">
              {selectedCustomer ? (
                <motion.div
                  key="customer-selected"
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {showPaymentDue ? (
                    <div className="px-4 py-2 bg-primary/10 border border-primary/50 rounded-none flex items-center gap-2.5">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-none">
                        <span className="text-sm font-bold">{selectedCustomer.name.charAt(0)}</span>
                      </div>
                      <div className="font-semibold text-sm text-foreground">{selectedCustomer.name}</div>
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-card border border-primary/30 rounded-[4px] flex items-center gap-2.5 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                      <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-none">
                        <span className="text-sm font-bold">{selectedCustomer.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-foreground">{selectedCustomer.name}</div>
                        <div className="text-xs text-muted-foreground">{selectedCustomer.email} • {selectedCustomer.phone}</div>
                      </div>
                      <button
                        onClick={onActivateCustomerSearch}
                        className="px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-none text-sm text-foreground transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                !showPaymentDue && (
                  <motion.div
                    key="add-customer-btn"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={onActivateCustomerSearch}
                      className="px-6 py-3 bg-white/5 border border-white/10 text-primary rounded-none text-[12px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10 transition-all flex items-center gap-3 group"
                    >
                      <UserPlus className="w-5 h-5" />
                      Add Customer
                    </button>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Product Table - with bottom padding to prevent overlap with fixed footer */}
        <div className="flex-1 overflow-y-auto p-6 pb-32">
          <ProductTable
            items={items}
            selectedItems={selectedItems}
            onToggleItem={handleToggleItem}
            onToggleAll={handleToggleAll}
            onChangeType={handleChangeType}
            onChangePrice={handleChangePrice}
            onChangeQty={handleChangeQty}
            onRemoveItem={handleRemoveItem}
            onAddSerialNumber={handleAddSerialNumber}
            isPaymentMode={showPaymentDue}
          />
        </div>

        {/* Footer with Totals - Fixed to bottom */}
        <div 
          className={`fixed bottom-0 left-0 bg-card border-t border-border px-6 py-2 z-30 w-full transition-all duration-300 ${showPaymentDue ? 'pr-[37.5rem]' : ''}`}
        >
          <div className="flex items-center justify-between max-w-full mx-auto gap-8">
            {/* Transaction Breakdown */}
            {items.length > 0 && (
              <div className="flex gap-8">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sell</div>
                  <div className="text-lg font-bold text-[#10B981] font-normal">£{sellTotal.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Buy</div>
                  <div className="text-lg font-bold text-[#8B5CF6] font-normal">£{buyTotal.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Exchange</div>
                  <div className="text-lg font-bold text-[#3B82F6] font-normal">£{exchangeTotal.toFixed(2)}</div>
                </div>
                <div className="h-8 w-px bg-border self-center" />
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IN</div>
                  <div className="text-lg font-bold text-foreground font-normal">{inCount} items</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">OUT</div>
                  <div className="text-lg font-bold text-foreground font-normal">{outCount} items</div>
                </div>
              </div>
            )}

            {/* Primary CTA */}
            {!showPaymentDue && (
              <button
                disabled={ctaState.disabled}
                onClick={() => setShowPaymentDue(true)}
                className="ml-auto px-8 py-2 bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground rounded-none text-lg font-semibold transition-colors whitespace-nowrap hover:scale-[1.01] active:scale-[0.99] flex items-center gap-3"
              >
                {ctaState.text}
                {!ctaState.disabled && (
                  <kbd className="px-2 py-1 bg-black/20 border border-primary-foreground/20 text-xs font-mono text-primary-foreground font-semibold shadow-sm">
                    Enter
                  </kbd>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Serial Number Modal */}
      {serialModalItem && (
        <SerialNumberModal
          boxName={serialModalItem.boxName}
          onSave={handleSaveSerialNumber}
          onCancel={() => setSerialModalItem(null)}
        />
      )}

      {/* Payment Due Modal */}
      <PaymentDue
        isOpen={showPaymentDue}
        onClose={() => setShowPaymentDue(false)}
        onComplete={() => {
          onTransactionComplete?.();
          // Fallback reset if onTransactionComplete isn't provided or doesn't cause remount
          setItems([]);
          setSelectedItems([]);
          setCustomerAdded(false);
          setShowPaymentDue(false);
        }}
        total={total}
        sellTotal={sellTotal}
        buyTotal={buyTotal}
        exchangeTotal={exchangeTotal}
      />
    </div>
  );
}