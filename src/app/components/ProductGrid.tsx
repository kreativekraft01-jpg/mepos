import { Plus } from 'lucide-react';
import { Product } from '@/app/types';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 auto-rows-fr">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => onAddToCart(product)}
          className="bg-white border-2 border-neutral-200 hover:border-neutral-900 active:bg-neutral-100 rounded-lg p-4 flex flex-col items-start justify-between min-h-[120px] transition-colors text-left"
          title={`Add ${product.name} - $${product.price.toFixed(2)}`}
        >
          <div className="flex-1 w-full">
            <div className="text-lg leading-tight mb-1">{product.name}</div>
            <div className="text-sm text-neutral-600">{product.category}</div>
          </div>
          <div className="flex items-center justify-between w-full mt-2">
            <span className="text-xl">${product.price.toFixed(2)}</span>
            <Plus className="w-6 h-6 text-neutral-900" />
          </div>
        </button>
      ))}
    </div>
  );
}
