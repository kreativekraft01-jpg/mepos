import { X, Package, User, ShoppingBag, Plus, Tag, TestTube2, FileEdit, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import type { TransactionItem } from '../types';

interface SearchResultsProps {
  query: string;
  customers?: CustomerResult[];
  onClose: () => void;
  onAddToCurrentTransaction: (item: TransactionItem) => void;
  onAddToNewTransaction: (item: TransactionItem) => void;
  onAttachCustomer?: (customer: CustomerResult) => void;
  onViewCustomer?: (customer: CustomerResult) => void;
  onViewAllCustomers?: () => void;
}

interface BoxResult {
  id: string;
  name: string;
  category: string;
  boxId: string;
  stockLevel: number;
  sellPrice: number;
  buyPrice: number;
  exchangePrice: number;
  status: 'active' | 'discontinued' | 'deleted';
}

interface CustomerResult {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyaltyPoints: number;
}

interface OrderResult {
  id: string;
  orderNumber: string;
  customer: string;
  date: string;
  total: number;
  type: 'sell' | 'buy' | 'exchange';
}

export type { CustomerResult };

export const MOCK_BOX_RESULTS: BoxResult[] = [
  {
    id: '1',
    name: 'iPhone 14 Pro 256GB Space Black',
    category: 'Computing / Mobile Phones',
    boxId: '9876543',
    stockLevel: 3,
    sellPrice: 799.00,
    buyPrice: 650.00,
    exchangePrice: 725.00,
    status: 'active',
  },
  {
    id: '2',
    name: 'PlayStation 5 Console',
    category: 'Gaming / PlayStation',
    boxId: '5551234',
    stockLevel: 5,
    sellPrice: 449.00,
    buyPrice: 380.00,
    exchangePrice: 415.00,
    status: 'active',
  },
  {
    id: '3',
    name: 'Call of Duty: Modern Warfare III',
    category: 'Gaming / PlayStation',
    boxId: '1234567',
    stockLevel: 8,
    sellPrice: 3.00,
    buyPrice: 1.00,
    exchangePrice: 2.00,
    status: 'active',
  },
  {
    id: '4',
    name: 'iPhone 13 Pro 128GB Graphite',
    category: 'Computing / Mobile Phones',
    boxId: '1112223',
    stockLevel: 0,
    sellPrice: 599.00,
    buyPrice: 450.00,
    exchangePrice: 520.00,
    status: 'discontinued',
  },
  {
    id: '5',
    name: 'Legacy PS4 Console',
    category: 'Gaming / PlayStation',
    boxId: '9998887',
    stockLevel: 0,
    sellPrice: 150.00,
    buyPrice: 80.00,
    exchangePrice: 100.00,
    status: 'deleted',
  },
];

export const MOCK_CUSTOMER_RESULTS: CustomerResult[] = [
  {
    id: '1',
    name: 'Michael Johnson',
    email: 'michael.j@email.com',
    phone: '07700 900123',
    loyaltyPoints: 450,
  },
  {
    id: '2',
    name: 'Emma Wilson',
    email: 'emma.w@email.com',
    phone: '07700 900456',
    loyaltyPoints: 230,
  },
];

export const MOCK_ORDER_RESULTS: OrderResult[] = [
  {
    id: '1',
    orderNumber: 'ORD-2024-0156',
    customer: 'Michael Johnson',
    date: '2024-01-22 14:32',
    total: 1251.00,
    type: 'sell',
  },
  {
    id: '2',
    orderNumber: 'ORD-2024-0155',
    customer: 'Emma Wilson',
    date: '2024-01-22 13:15',
    total: 450.00,
    type: 'buy',
  },
];

export function SearchResults({ 
  query, 
  customers = MOCK_CUSTOMER_RESULTS,
  onClose, 
  onAddToCurrentTransaction, 
  onAddToNewTransaction, 
  onAttachCustomer, 
  onViewCustomer,
  onViewAllCustomers
}: SearchResultsProps) {
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [availability, setAvailability] = useState('');
  const [showDiscontinued, setShowDiscontinued] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [expandedBoxId, setExpandedBoxId] = useState<string | null>(null);
  
  const searchLower = query.toLowerCase();

  // Filter boxes based on query and filters
  const filteredBoxes = MOCK_BOX_RESULTS.filter(box => {
    // Text search
    const matchesSearch = 
      box.name.toLowerCase().includes(searchLower) ||
      box.boxId.includes(query) ||
      box.category.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    // Filters
    if (category && !box.category.toLowerCase().includes(category)) return false;
    if (status && box.status !== status) return false;
    
    // Availability
    if (availability === 'instock' && box.stockLevel <= 0) return false;
    if (availability === 'outofstock' && box.stockLevel > 0) return false;
    if (availability === 'lowstock' && (box.stockLevel > 3 || box.stockLevel === 0)) return false;

    // Status flags
    if (status !== 'discontinued' && !showDiscontinued && box.status === 'discontinued') return false;
    if (status !== 'deleted' && !showDeleted && box.status === 'deleted') return false;

    return true;
  });

  // Filter customers based on query
  const filteredCustomers = customers.filter(customer => {
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email.toLowerCase().includes(searchLower) ||
      customer.phone.includes(query)
    );
  });

  // Filter orders based on query
  const filteredOrders = MOCK_ORDER_RESULTS.filter(order => {
    return (
      order.orderNumber.toLowerCase().includes(searchLower) ||
      order.customer.toLowerCase().includes(searchLower)
    );
  });

  const hasQuery = query.trim().length > 0;
  const hasResults = filteredBoxes.length > 0 || filteredCustomers.length > 0 || filteredOrders.length > 0;

  return (
    <div className="fixed top-[70px] left-6 right-6 mt-[8px] bg-card rounded-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border-4 border-border z-[100] text-foreground">
      {/* Results */}
      <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
        {!hasQuery ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-base">Start typing to search for boxes, customers, or orders...</p>
          </div>
        ) : !hasResults ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-base">No results found for "{query}"</p>
          </div>
        ) : (
          <div>
            {/* Box Results */}
            {filteredBoxes.length > 0 && (
              <div className="border-b-2 border-border">
                <div className="sticky top-0 bg-muted px-4 py-3 flex items-center justify-between gap-4 border-b border-border z-10">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-muted-foreground" />
                    <h4 className="text-sm font-bold text-foreground">Boxes ({filteredBoxes.length})</h4>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
                    <div className="relative">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="px-4 py-2 pr-10 border-2 border-border rounded-none text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary min-w-[140px] appearance-none"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <option value="">All Categories</option>
                        <option value="gaming">Gaming</option>
                        <option value="computing">Computing</option>
                        <option value="phones">Mobile Phones</option>
                        <option value="audio">Audio</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="px-4 py-2 pr-10 border-2 border-border rounded-none text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary min-w-[120px] appearance-none"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="discontinued">Discontinued</option>
                        <option value="deleted">Deleted</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="relative">
                      <select
                        value={availability}
                        onChange={(e) => setAvailability(e.target.value)}
                        className="px-4 py-2 pr-10 border-2 border-border rounded-none text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary min-w-[140px] appearance-none"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <option value="">All Availability</option>
                        <option value="instock">In Stock</option>
                        <option value="lowstock">Low Stock</option>
                        <option value="outofstock">Out of Stock</option>
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>

                    {/* Status Checkboxes */}
                    <div className="flex items-center gap-4 pl-2 border-l border-border h-8">
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className={`w-4 h-4 border border-muted-foreground transition-colors flex items-center justify-center ${showDiscontinued ? 'bg-primary border-primary' : 'bg-transparent group-hover:border-primary'}`}>
                          {showDiscontinued && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Discontinued</span>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={showDiscontinued} 
                          onChange={(e) => setShowDiscontinued(e.target.checked)} 
                        />
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className={`w-4 h-4 border border-muted-foreground transition-colors flex items-center justify-center ${showDeleted ? 'bg-primary border-primary' : 'bg-transparent group-hover:border-primary'}`}>
                          {showDeleted && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Deleted</span>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={showDeleted} 
                          onChange={(e) => setShowDeleted(e.target.checked)} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  {filteredBoxes.map((box) => (
                    <div key={box.id} className="mb-1">
                      <button
                        onClick={() => setExpandedBoxId(expandedBoxId === box.id ? null : box.id)}
                        className={`w-full p-3 rounded-none transition-colors text-left border-2 ${
                          expandedBoxId === box.id
                            ? 'bg-primary/10 border-primary'
                            : 'border-transparent hover:border-primary/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-base truncate text-foreground">{box.name}</span>
                              <span className="px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-none flex-shrink-0">
                                Stock: {box.stockLevel}
                              </span>
                              {box.status === 'discontinued' && (
                                <span className="px-2 py-0.5 bg-destructive/10 text-destructive text-xs rounded-none flex-shrink-0">
                                  Discontinued
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{box.category} • ID: {box.boxId}</div>
                          </div>
                          <div className="flex gap-4 flex-shrink-0">
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5 text-[14px] text-[13px]">Sell</div>
                              <div className="text-sm font-bold text-[#34D399] font-normal">
                                £{box.sellPrice.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5 text-[14px] text-[13px]">Buy</div>
                              <div className="text-sm font-bold text-[#A78BFA] font-normal">
                                £{box.buyPrice.toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground mb-0.5 text-[14px] text-[13px]">Exch</div>
                              <div className="text-sm font-bold text-[#60A5FA] font-normal">
                                £{box.exchangePrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                      
                      {/* Quick Actions */}
                      {expandedBoxId === box.id && (
                        <div className="bg-primary/10 border-2 border-t-0 border-primary rounded-none p-3">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToCurrentTransaction({
                                  id: box.id,
                                  boxName: box.name,
                                  stockLevel: box.stockLevel,
                                  category: box.category,
                                  boxId: box.boxId,
                                  type: 'sell',
                                  price: box.sellPrice,
                                  qty: 1,
                                  requiresSerial: false,
                                });
                                onClose();
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-110 text-primary-foreground rounded-none transition-colors text-sm font-medium"
                            >
                              <Plus className="w-4 h-4" />
                              Current Transaction
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToNewTransaction({
                                  id: box.id,
                                  boxName: box.name,
                                  stockLevel: box.stockLevel,
                                  category: box.category,
                                  boxId: box.boxId,
                                  type: 'sell',
                                  price: box.sellPrice,
                                  qty: 1,
                                  requiresSerial: false,
                                });
                                onClose();
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-card border-2 border-primary/40 text-primary rounded-none transition-colors text-sm font-regular hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                            >
                              <FileEdit className="w-4 h-4" />
                              New Transaction
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Relabel');
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-card border-2 border-primary/40 text-primary rounded-none transition-colors text-sm font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                            >
                              <Tag className="w-4 h-4" />
                              Relabel
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                alert('Test Order');
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-card border-2 border-primary/40 text-primary rounded-none transition-colors text-sm font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                            >
                              <TestTube2 className="w-4 h-4" />
                              Test Order
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Results */}
            {filteredCustomers.length > 0 && (
              <div className="border-b-2 border-border">
                <div className="sticky top-0 bg-muted px-4 py-3 flex items-center justify-between gap-2 border-b border-border z-10">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <h4 className="text-sm font-bold text-foreground">Customers ({filteredCustomers.length})</h4>
                  </div>
                  {onViewAllCustomers && (
                     <button 
                       onClick={() => {
                         onViewAllCustomers();
                         onClose();
                       }}
                       className="text-xs text-primary hover:underline font-bold uppercase tracking-wider"
                     >
                       View All
                     </button>
                  )}
                </div>
                <div className="p-2">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        if (onViewCustomer) {
                          onViewCustomer(customer);
                          onClose();
                        }
                      }}
                      className="mb-1 flex items-center justify-between p-3 border-2 border-transparent hover:border-primary/50 hover:bg-muted transition-colors rounded-none cursor-pointer group"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-base mb-0.5 text-foreground group-hover:text-primary transition-colors">{customer.name}</div>
                        <div className="text-xs text-muted-foreground">{customer.email} • {customer.phone}</div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onAttachCustomer) {
                            onAttachCustomer(customer);
                            onClose();
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:brightness-110 text-primary-foreground rounded-none transition-colors text-sm font-semibold z-20"
                      >
                        <Plus className="w-4 h-4" />
                        Attach to Transaction
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order Results */}
            {filteredOrders.length > 0 && (
              <div>
                <div className="sticky top-0 bg-muted px-4 py-3 flex items-center gap-2 border-b border-border z-10">
                  <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                  <h4 className="text-sm font-bold text-foreground">Orders ({filteredOrders.length})</h4>
                </div>
                <div className="p-2">
                  {filteredOrders.map((order) => (
                    <button
                      key={order.id}
                      className="w-full p-3 hover:bg-muted rounded-none transition-colors text-left border-2 border-transparent hover:border-border mb-1"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-base mb-0.5 text-foreground">{order.orderNumber}</div>
                          <div className="text-xs text-muted-foreground">{order.customer} • {order.date}</div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div className="text-sm font-bold text-foreground">£{order.total.toFixed(2)}</div>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-none capitalize ${
                              order.type === 'sell'
                              ? 'bg-[#34D399]/20 text-[#34D399]'
                              : order.type === 'buy'
                              ? 'bg-[#A78BFA]/20 text-[#A78BFA]'
                              : 'bg-[#60A5FA]/20 text-[#60A5FA]'
                            }`}
                          >
                            {order.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}