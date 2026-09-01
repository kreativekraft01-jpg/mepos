import { Menu, Search, UserPlus, History, ShoppingCart, ChevronDown, PlusCircle, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { SearchResults, type CustomerResult } from './SearchResults';
import type { TransactionItem } from '../types';

interface TopNavigationProps {
  currentFloat: { amount: number; name: string } | null;
  customers?: CustomerResult[];
  onOpenSidebar: () => void;
  onAddCustomer: () => void;
  onRecentTransactions: () => void;
  onCart: () => void;
  onChangeFloat: () => void;
  isCartPage?: boolean;
  onNewTransaction?: () => void;
  onLogoClick?: () => void;
  isCustomerSearchActive?: boolean;
  onDeactivateCustomerSearch?: () => void;
  onAddToCurrentTransaction: (item: TransactionItem) => void;
  onAddToNewTransaction: (item: TransactionItem) => void;
  onAttachCustomer?: (customer: CustomerResult) => void;
  onViewCustomer?: (customer: CustomerResult) => void;
  onViewAllCustomers?: () => void;
}

export function TopNavigation({
  currentFloat,
  customers,
  onOpenSidebar,
  onAddCustomer,
  onRecentTransactions,
  onCart,
  onChangeFloat,
  isCartPage = false,
  onNewTransaction,
  onLogoClick,
  isCustomerSearchActive = false,
  onDeactivateCustomerSearch,
  onAddToCurrentTransaction,
  onAddToNewTransaction,
  onAttachCustomer,
  onViewCustomer,
  onViewAllCustomers,
}: TopNavigationProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Focus search input when customer search is activated
  useEffect(() => {
    if (isCustomerSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
      setShowSearchResults(true);
    }
  }, [isCustomerSearchActive]);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
        if (onDeactivateCustomerSearch) {
          onDeactivateCustomerSearch();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onDeactivateCustomerSearch]);

  // Handle Escape key to close search
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSearchResults) {
        setShowSearchResults(false);
        setSearchQuery('');
        searchInputRef.current?.blur();
        if (onDeactivateCustomerSearch) {
          onDeactivateCustomerSearch();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showSearchResults, onDeactivateCustomerSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Only show results if there's text
    setShowSearchResults(value.trim().length > 0);
  };

  const handleCloseSearch = () => {
    setShowSearchResults(false);
    setSearchQuery('');
    searchInputRef.current?.blur();
    if (onDeactivateCustomerSearch) {
      onDeactivateCustomerSearch();
    }
  };

  const handleSearchFocus = () => {
    // Only show results if there's already text
    if (searchQuery.trim().length > 0) {
      setShowSearchResults(true);
    }
  };

  return (
    <nav className="bg-card text-foreground border-b border-border relative z-50">
      <div className="flex items-center gap-4 px-4 py-3 relative">
        {/* Sidebar Menu Icon */}
        <button
          onClick={onOpenSidebar}
          className="p-3 hover:bg-muted rounded-none transition-colors border border-transparent hover:border-border text-muted-foreground"
          title="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* MEPoS Logo */}
        <button
          onClick={onLogoClick}
          className="flex items-center hover:bg-muted rounded-none transition-colors px-4 py-2 border border-transparent hover:border-border group"
          title="Go to Home"
        >
          <div className="text-2xl font-black italic tracking-tighter text-foreground transition-all duration-300 group-hover:tracking-normal relative">
            ME<span className="text-primary drop-shadow-[0_0_10px_rgba(219,115,55,0.5)]">PoS</span>
            <div className="absolute -bottom-1 right-0 w-8 h-0.5 bg-primary/50 group-hover:w-full transition-all duration-500 ease-out"></div>
          </div>
        </button>

        {/* Search Bar */}
        <div className="flex-[2] min-w-0" ref={searchContainerRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search box, customer or order"
              className="w-full pl-12 pr-12 py-3 bg-muted border border-border rounded-[4px] text-base focus:outline-none focus:border-primary placeholder:text-neutral-500 transition-colors text-foreground"
              ref={searchInputRef}
              onFocus={handleSearchFocus}
            />
            {searchQuery && (
              <button
                onClick={handleCloseSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-none transition-colors"
                title="Clear search"
              >
                <X className="w-5 h-5 text-neutral-400 hover:text-foreground" />
              </button>
            )}
          </div>
          {showSearchResults && (
            <div className="relative">
              <SearchResults 
                query={searchQuery} 
                customers={customers}
                onClose={handleCloseSearch}
                onAddToCurrentTransaction={onAddToCurrentTransaction}
                onAddToNewTransaction={onAddToNewTransaction}
                onAttachCustomer={onAttachCustomer}
                onViewCustomer={onViewCustomer}
                onViewAllCustomers={onViewAllCustomers}
              />
            </div>
          )}
        </div>

        {/* Action Icons */}
        <div className="flex-1 flex items-center justify-between gap-2 ml-4">
          {/* Add Customer */}
          <button
            onClick={onAddCustomer}
            className="p-3 hover:bg-muted rounded-none transition-colors group relative border border-transparent hover:border-border text-muted-foreground"
            title="Add Customer"
          >
            <UserPlus className="w-6 h-6 group-hover:text-primary transition-colors" />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-card border border-border text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Add Customer
            </span>
          </button>

          {/* Recent Transactions */}
          <button
            onClick={onRecentTransactions}
            className="p-3 hover:bg-muted rounded-none transition-colors group relative border border-transparent hover:border-border text-muted-foreground"
            title="Recent Transactions"
          >
            <History className="w-6 h-6 group-hover:text-primary transition-colors" />
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-card border border-border text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Recent Transactions
            </span>
          </button>

          {/* Cart or New Transaction */}
          {isCartPage ? (
            <button
              onClick={onNewTransaction}
              className="p-3 hover:bg-muted rounded-none transition-colors group relative border border-transparent hover:border-border"
              title="New Transaction"
            >
              <PlusCircle className="w-6 h-6 text-primary" />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-card border border-border text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                New Transaction
              </span>
            </button>
          ) : (
            <button
              onClick={onCart}
              className="p-3 hover:bg-muted rounded-none transition-colors group relative border border-transparent hover:border-border"
              title="Cart"
            >
              <ShoppingCart className="w-6 h-6 group-hover:text-primary transition-colors" />
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-card border border-border text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Cart
              </span>
            </button>
          )}

          {/* Float Selection */}
          <button
            onClick={onChangeFloat}
            className="ml-2 px-4 py-3 bg-muted hover:bg-secondary rounded-[4px] transition-colors flex items-center gap-2 text-base border border-border group"
            title="Change float"
          >
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{currentFloat?.name || 'No Float'}</span>
            <ChevronDown className="w-4 h-4 text-neutral-400 group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </nav>
  );
}