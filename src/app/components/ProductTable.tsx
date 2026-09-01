import { AlertCircle, ChevronDown, ScanBarcode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { TransactionItem } from '../types';
import { SwipeableItem } from './SwipeableItem';

interface ProductTableProps {
  items: TransactionItem[];
  selectedItems: string[];
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  onChangeType: (id: string, type: 'sell' | 'buy' | 'exchange') => void;
  onChangePrice: (id: string, price: number) => void;
  onChangeQty: (id: string, qty: number) => void;
  onRemoveItem: (id: string) => void;
  onAddSerialNumber: (id: string) => void;
  isPaymentMode?: boolean;
}

export function ProductTable({
  items,
  selectedItems,
  onToggleItem,
  onToggleAll,
  onChangeType,
  onChangePrice,
  onChangeQty,
  onRemoveItem,
  onAddSerialNumber,
  isPaymentMode = false,
}: ProductTableProps) {
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  // Empty state
  if (items.length === 0) {
    return (
      <div className="bg-card rounded-none border border-border flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <ScanBarcode className="w-24 h-24" strokeWidth={1.5} />
          </motion.div>
          <p className="text-xl font-medium">Scan or search for an item</p>
        </div>
      </div>
    );
  }

  // Grid column configurations - optimized for tablet widths
  const paymentColumns = "grid-cols-[2fr_1fr_1fr_1fr]";
  const normalColumns = "grid-cols-[48px_2.5fr_1fr_1fr_1.2fr_1fr_100px]";

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'sell': return 'text-[#39BF82]'; // Soft Emerald 200
      case 'buy': return 'text-[#A391FA]';   // Soft Violet 200
      case 'exchange': return 'text-[#72B0FE]'; // Soft Blue 200
      default: return 'text-foreground';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch(type) {
      case 'sell': return 'bg-[#39BF82]/10 text-[#39BF82] border-[#39BF82]/20';
      case 'buy': return 'bg-[#A391FA]/10 text-[#A391FA] border-[#A391FA]/20';
      case 'exchange': return 'bg-[#72B0FE]/10 text-[#72B0FE] border-[#72B0FE]/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeBorderColor = (type: string) => {
    switch(type) {
      case 'sell': return 'border-[#39BF82]/30 hover:bg-[#39BF82]/5 hover:border-[#39BF82]/50 shadow-[0_0_15px_rgba(167,243,208,0.05)]';
      case 'buy': return 'border-[#A391FA]/30 hover:bg-[#A391FA]/5 hover:border-[#A391FA]/50 shadow-[0_0_15px_rgba(221,214,254,0.05)]';
      case 'exchange': return 'border-[#72B0FE]/30 hover:bg-[#72B0FE]/5 hover:border-[#72B0FE]/50 shadow-[0_0_15px_rgba(191,219,254,0.05)]';
      default: return 'border-border focus:border-primary';
    }
  };

  return (
    <div className="bg-card rounded-none border border-border overflow-hidden shadow-sm">
      {/* Header Grid */}
      <div className={`grid ${isPaymentMode ? paymentColumns : normalColumns} bg-muted border-b border-border font-medium text-xs text-muted-foreground uppercase tracking-wider`}>
        {isPaymentMode ? (
          <>
            <div className="p-2">Item Name</div>
            <div className="p-2">Type</div>
            <div className="p-2">Price</div>
            <div className="p-2">Qty</div>
          </>
        ) : (
          <>
            <div className="p-2 flex items-center justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="w-4 h-4 cursor-pointer accent-primary rounded-none border-border bg-input"
              />
            </div>
            <div className="p-2">Product / Stock</div>
            <div className="p-2 text-center">Category</div>
            <div className="p-2 text-center">Box ID</div>
            <div className="p-2 text-left">Type</div>
            <div className="p-2 text-center">Price</div>
            <div className="p-2 text-center">Qty</div>
          </>
        )}
      </div>

      {/* Body Rows */}
      <div className="divide-y divide-border">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => {
            // Inner content function to avoid duplication
            const RowContent = () => (
              <div className={`grid ${isPaymentMode ? paymentColumns : normalColumns} items-center min-h-[50px] bg-card ${!isPaymentMode ? 'group-hover:bg-muted/50' : ''} transition-colors`}>
                {isPaymentMode ? (
                  <>
                    <div className="p-2">
                      <span className="text-sm font-medium text-foreground">{item.boxName}</span>
                    </div>
                    <div className="p-2">
                      <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase border ${getTypeBadgeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </div>
                    <div className={`p-2 font-bold text-sm ${getTypeColor(item.type)}`}>
                      £{item.price.toFixed(2)}
                    </div>
                    <div className="p-2 text-sm font-medium text-muted-foreground">
                      {item.qty}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Checkbox */}
                    <div className="p-2 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => onToggleItem(item.id)}
                        className="w-4 h-4 cursor-pointer accent-primary rounded-none border-border bg-input"
                      />
                    </div>

                    {/* Box Name with Serial Number Alert */}
                    <div className="p-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground leading-tight line-clamp-1">
                          {item.boxName} <span className="text-muted-foreground font-normal">({item.stockLevel})</span>
                        </span>
                        {item.requiresSerial && !item.serialNumber && (
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddSerialNumber(item.id);
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-none border border-destructive/30 transition-colors"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span className="text-[9px] font-bold uppercase">Add SN</span>
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category */}
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      {item.category.split(' / ')[1] || item.category}
                    </div>

                    {/* Box ID */}
                    <div className="p-2 text-center text-xs font-mono text-muted-foreground opacity-70">
                      {item.boxId}
                    </div>

                    {/* Type Toggle Button */}
                    <div className="p-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          const nextType = item.type === 'sell' ? 'buy' : item.type === 'buy' ? 'exchange' : 'sell';
                          onChangeType(item.id, nextType);
                        }}
                        className={`group/type relative flex items-center gap-2 px-3 py-1.5 border rounded-sm text-xs font-black bg-transparent hover:bg-muted/50 cursor-pointer focus:outline-none uppercase transition-all text-left w-auto ${getTypeColor(item.type)} ${getTypeBorderColor(item.type)}`}
                      >
                        <span>{item.type === 'exchange' ? 'Exch' : item.type}</span>
                      </motion.button>
                    </div>

                    {/* Price */}
                    <div className={`p-2 text-center font-medium text-sm ${getTypeColor(item.type)}`}>
                      £{item.price.toFixed(2)}
                    </div>

                    {/* Quantity */}
                    <div className="p-2 flex justify-center">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          onChangeQty(item.id, parseInt(e.target.value) || 1)
                        }
                        min="1"
                        className="w-12 px-1 py-1 border border-border rounded-none text-sm text-center font-medium bg-input text-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </>
                )}
              </div>
            );

            if (isPaymentMode) {
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-border last:border-0 overflow-hidden"
                >
                  <RowContent />
                </motion.div>
              );
            }

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(178,105,68, 0.2)' }}
                animate={{ opacity: 1, x: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                exit={{ opacity: 0, x: 20, height: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <SwipeableItem 
                  onDelete={() => onRemoveItem(item.id)}
                  className="group"
                >
                  <RowContent />
                </SwipeableItem>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
