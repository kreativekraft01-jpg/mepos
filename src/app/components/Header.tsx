import { History, X } from 'lucide-react';

interface HeaderProps {
  onViewHistory: () => void;
  onClearCart: () => void;
  hasItems: boolean;
}

export function Header({ onViewHistory, onClearCart, hasItems }: HeaderProps) {
  return (
    <div className="bg-neutral-900 text-foreground px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl">MEPoS</h1>
          <p className="text-base text-neutral-400 mt-1">Fast. Reliable. Simple.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClearCart}
            disabled={!hasItems}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:cursor-not-allowed rounded-lg flex items-center gap-2 text-base transition-colors text-white"
            title="Clear cart (Ctrl+X)"
          >
            <X className="w-5 h-5" />
            Clear Cart
          </button>
          <button
            onClick={onViewHistory}
            className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded-lg flex items-center gap-2 text-base transition-colors text-foreground"
            title="View order history"
          >
            <History className="w-5 h-5" />
            History
          </button>
        </div>
      </div>
    </div>
  );
}
