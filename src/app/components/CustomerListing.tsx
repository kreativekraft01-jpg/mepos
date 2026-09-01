import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  MoreHorizontal, 
  ShoppingCart, 
  TestTube2, 
  RotateCcw, 
  Gift 
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';

interface Customer {
  id: string;
  type: 'Unified' | 'Legacy';
  firstName: string;
  lastName: string;
  address: string;
  email: string;
  mobile: string;
}

const MOCK_CUSTOMERS: Customer[] = [
  {
    id: '1',
    type: 'Unified',
    firstName: 'Michael',
    lastName: 'Johnson',
    address: '123 High Street, Watford, WD17 1AA',
    email: 'michael.j@email.com',
    mobile: '07700 900123'
  },
  {
    id: '2',
    type: 'Legacy',
    firstName: 'Emma',
    lastName: 'Wilson',
    address: '45 The Avenue, London, N1 0AA',
    email: 'emma.w@email.com',
    mobile: '07700 900456'
  },
  {
    id: '3',
    type: 'Unified',
    firstName: 'David',
    lastName: 'Brown',
    address: '88 Station Road, Bushey, WD23 2BB',
    email: 'david.b@email.com',
    mobile: '07700 900789'
  },
  {
    id: '4',
    type: 'Unified',
    firstName: 'Sarah',
    lastName: 'Davis',
    address: 'Flat 4, The Lofts, Watford, WD18 0CC',
    email: 'sarah.d@email.com',
    mobile: '07700 900222'
  },
  {
    id: '5',
    type: 'Legacy',
    firstName: 'James',
    lastName: 'Miller',
    address: '12 Oak Lane, Croxley Green, WD3 3DD',
    email: 'james.m@email.com',
    mobile: '07700 900333'
  }
];

interface CustomerListingProps {
  onBack: () => void;
  onCustomerClick: (customer: any) => void;
  onAttachToTransaction: (customer: any) => void;
  onTestOrder: (customer: any) => void;
  onRefund: (customer: any) => void;
  onGiftVoucher: (customer: any) => void;
}

export function CustomerListing({
  onBack,
  onCustomerClick,
  onAttachToTransaction,
  onTestOrder,
  onRefund,
  onGiftVoucher
}: CustomerListingProps) {
  const [filterType, setFilterType] = useState<'All' | 'Unified' | 'Legacy'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Escape - Go back
      if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
      // F - Filter toggle (cycles through All > Unified > Legacy)
      else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFilterType(prev => {
          if (prev === 'All') return 'Unified';
          if (prev === 'Unified') return 'Legacy';
          return 'All';
        });
      }
      // / or S - Focus search
      else if (e.key === '/' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack]);

  const filteredCustomers = MOCK_CUSTOMERS.filter(customer => {
    // Type Filter
    if (filterType !== 'All' && customer.type !== filterType) return false;
    
    // Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        customer.firstName.toLowerCase().includes(query) ||
        customer.lastName.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.mobile.includes(query)
      );
    }
    
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-card shrink-0 px-[24px] py-[14px]">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-muted text-neutral-400 hover:text-foreground rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-baseline items-center gap-4">
            <h1 className="text-xl font-black text-foreground uppercase tracking-wider">
              Customer Search
            </h1>
            <div className="h-5 w-px bg-[#2A2F34]" />
            <div className="text-sm text-neutral-400 font-mono">
              {filteredCustomers.length} Customers Found
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">

          {/* Type Filter */}
          <div className="flex items-center bg-muted border border-border p-1 rounded-sm">
             {(['All', 'Unified', 'Legacy'] as const).map(type => (
               <button
                 key={type}
                 onClick={() => setFilterType(type)}
                 className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                   filterType === type 
                     ? 'bg-primary text-primary-foreground shadow-sm' 
                     : 'text-neutral-400 hover:text-foreground'
                 }`}
               >
                 {type}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto bg-background p-6">
        <div className="w-full text-left border border-border">
          {/* Table Header */}
          <div className="grid grid-cols-12 bg-muted border-b border-border text-xs font-bold text-neutral-500 uppercase tracking-widest sticky top-0 z-10">
             <div className="col-span-1 px-4 py-2">Type</div>
             <div className="col-span-2 px-4 py-2">First Name</div>
             <div className="col-span-2 px-4 py-2">Last Name</div>
             <div className="col-span-3 px-4 py-2">Address</div>
             <div className="col-span-2 px-4 py-2">Email</div>
             <div className="col-span-1 px-4 py-2">Mobile</div>
             <div className="col-span-1 px-4 py-2 text-center">Action</div>
          </div>

          {/* Table Body */}
          <div className="bg-card">
            {filteredCustomers.map(customer => (
              <div 
                key={customer.id} 
                onClick={() => onCustomerClick(customer)}
                className="grid grid-cols-12 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group items-center text-sm text-foreground"
              >
                 <div className="col-span-1 px-4 py-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      customer.type === 'Unified' 
                        ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                        : 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                    }`}>
                      {customer.type}
                    </span>
                 </div>
                 <div className="col-span-2 px-4 py-2 font-medium">{customer.firstName}</div>
                 <div className="col-span-2 px-4 py-2 font-medium">{customer.lastName}</div>
                 <div className="col-span-2 px-4 py-2 text-neutral-400 truncate" title={customer.address}>{customer.address}</div>
                 <div className="col-span-2 px-4 py-2 text-neutral-400 truncate" title={customer.email}>{customer.email}</div>
                 <div className="col-span-2 px-4 py-2 text-neutral-400 font-mono">{customer.mobile}</div>
                 
                 {/* Action Column */}
                 <div className="col-span-1 px-4 py-2 flex justify-center" onClick={(e) => e.stopPropagation()}>
                    <Popover.Root>
                      <Popover.Trigger asChild>
                        <button className="p-2 hover:bg-muted rounded-full transition-colors text-neutral-400 hover:text-foreground">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content className="w-48 bg-card border border-border shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest px-2 py-1.5 mb-1 border-b border-border">
                            Attach To
                          </div>
                          
                          <button 
                            onClick={() => onAttachToTransaction(customer)}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                          >
                            <ShoppingCart className="w-4 h-4 text-foreground" />
                            Transaction
                          </button>
                          
                          <button 
                            onClick={() => onTestOrder(customer)}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                          >
                            <TestTube2 className="w-4 h-4 text-foreground" />
                            Test Order
                          </button>
                          
                          <button 
                            onClick={() => onRefund(customer)}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                          >
                            <RotateCcw className="w-4 h-4 text-foreground" />
                            Refund
                          </button>
                          
                          <button 
                            onClick={() => onGiftVoucher(customer)}
                            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                          >
                            <Gift className="w-4 h-4 text-foreground" />
                            Gift Voucher
                          </button>
                          
                          <Popover.Arrow className="fill-border" />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}