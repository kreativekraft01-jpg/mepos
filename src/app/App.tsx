import { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

// Components
import { OpenBanking } from './components/OpenBanking';
import { TopNavigation } from './components/TopNavigation';
import { Sidebar } from './components/Sidebar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HomePage } from './components/HomePage';
import { CartPage } from './components/CartPage';
import { OrderHistory } from './components/OrderHistory';
import { ScreenSaver } from './components/ScreenSaver';
import { CustomerProfile } from './components/CustomerProfile';
import { CustomerListing } from './components/CustomerListing';
import { NewCustomerModal } from './components/NewCustomerModal';
import { RefundOrder } from './components/RefundOrder';
import { RefundCheckout } from './components/RefundCheckout';
import { GiftVoucherPage } from './components/GiftVoucherPage';

import { useStore, selectTodaysFigures } from '@/store/useStore';
import { toCustomerResult, transactionItemToCartItem, saleToOrderResult, productToBox, saleToTransaction, cartToTransaction } from './data/bridge';
import type { Transaction } from './types';
import { tillExpectedCash } from '@/utils/format';
import type { CustomerResult } from './components/SearchResults';
import type { TransactionItem } from './types';
import type { CartItem, PaymentMethod, PaymentSplit, Till } from '@/types';

type Page =
  | 'home'
  | 'cart'
  | 'customer-profile'
  | 'customer-listing'
  | 'refund-order'
  | 'refund-checkout'
  | 'gift-voucher';

interface RefundDetails {
  orderId: string;
  amount: number;
  reason: string;
  subReason: string;
  items?: unknown;
  method: string;
  receiptOptions: { print: boolean; email: boolean };
}

const REFUND_METHODS: Record<string, PaymentMethod> = {
  cash: 'cash',
  card: 'card',
  voucher: 'voucher',
  bank: 'bank_transfer',
  upi: 'upi',
  cheque: 'card',
  paypal: 'card',
  bitcoin: 'card',
  datacash: 'card',
  justeat: 'card'
};

/** Adapt a loosely-typed customer row (e.g. from the mock listing) into the UI CustomerResult shape. */
function toProfile(c: any): CustomerResult {
  return {
    id: c.id ?? '',
    name: c.name ?? (`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'),
    email: c.email ?? '',
    phone: c.mobile ?? c.phone ?? '',
    loyaltyPoints: 0
  };
}

/** Map a store cart row into a MEPoS transaction item. */
function cartItemToTransactionItem(c: CartItem): TransactionItem {
  return {
    id: c.id,
    boxName: c.name,
    stockLevel: c.stockLevel,
    category: c.category,
    boxId: c.boxId,
    type: c.type,
    price: c.price,
    qty: c.qty,
    requiresSerial: c.requiresSerial,
    serialNumber: c.serialNumber
  };
}

export default function App() {
  const store = useStore();
  const { customers, sales, tills, activeTillId, customerId, settings, products, categories } = store;

  const activeTill: Till | undefined = tills.find((t) => t.id === activeTillId && t.status === 'open');
  const currentFloat = activeTill ? { amount: activeTill.openingFloat, name: activeTill.name } : null;

  const customerResults: CustomerResult[] = customers.map(toCustomerResult);
  const selectedCustomer: CustomerResult | null = customerResults.find((c) => c.id === customerId) ?? null;
  const orderResults = sales.map((s) => saleToOrderResult(s, customers));
  const boxResults = products.map((p) => productToBox(p, categories));
  const todaysFigures = selectTodaysFigures(sales);
  const initialCartItems: TransactionItem[] = store.cart.map(cartItemToTransactionItem);

  // Recent Transactions data — processed (completed sales) and unprocessed (current cart + saved carts)
  const processedTransactions = sales.map((s) =>
    saleToTransaction(
      s,
      customers.find((c) => c.id === s.customerId)?.name ?? 'Walk-in Customer',
      tills.find((t) => t.id === s.tillId)
    )
  );
  const unprocessedTransactions: Transaction[] = [
    ...(store.cart.length > 0
      ? [
          cartToTransaction(store.cart, {
            customerName: customers.find((c) => c.id === store.customerId)?.name,
            till: activeTill
          })
        ]
      : []),
    ...store.savedCarts.map((sc) =>
      cartToTransaction(sc.items, {
        customerName: customers.find((c) => c.id === sc.customerId)?.name,
        till: activeTill,
        orderNumber: sc.id,
        createdAt: sc.createdAt
      })
    )
  ];

  // UI state
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showScreenSaver, setShowScreenSaver] = useState(true);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showCloseBankingDialog, setShowCloseBankingDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [previousPage, setPreviousPage] = useState<'home' | 'customer-listing' | 'gift-voucher'>('home');
  const [isCustomerSearchActive, setIsCustomerSearchActive] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<CustomerResult | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Cart
  const [cartKey, setCartKey] = useState(0);
  const [pendingCartItem, setPendingCartItem] = useState<TransactionItem | null>(null);

  // Refund flow state
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundDetails, setRefundDetails] = useState<RefundDetails | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [managerTag, setManagerTag] = useState('');
  const [showRefundSuccess, setShowRefundSuccess] = useState(false);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // Idle detection → screensaver (60 seconds)
  const idleTimer = useRef<any>(null);
  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!showScreenSaver) {
      idleTimer.current = setTimeout(() => setShowScreenSaver(true), 60000);
    }
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();
    events.forEach((event) => document.addEventListener(event, handleActivity));
    resetIdleTimer();
    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [showScreenSaver]);

  // Handle open banking
  const handleOpenBanking = (float: number, floatName: string) => {
    const match = floatName.match(/\d+/);
    const idx = match ? Math.max(0, parseInt(match[0], 10) - 1) : 0;
    const closedTills = tills.filter((t) => t.status === 'closed');
    const till = closedTills[idx] ?? closedTills[0] ?? tills[0];
    if (till) store.openTill(till.id, 'Staff', float);
    setShowScreenSaver(false);
    toast.success(`Register opened with ${floatName} (${settings.currency}${float.toFixed(2)})`);
  };

  const handleScreenSaverNavigate = (target: 'home' | 'cart') => {
    setCurrentPage(target);
    setShowScreenSaver(false);
  };

  // Handle close banking
  const handleCloseBanking = () => {
    setShowCloseBankingDialog(true);
  };

  const handleConfirmCloseBanking = () => {
    if (activeTill) {
      const expected = tillExpectedCash(activeTill, sales);
      store.closeTill(activeTill.id, { countedCash: expected, closedBy: 'Staff' });
    }
    setShowCloseBankingDialog(false);
    setShowSidebar(false);
    setShowScreenSaver(true);
    toast.info('Banking closed. Please start a new shift.');
  };

  // Home page handlers
  const handleNewCustomer = () => setShowNewCustomerModal(true);

  const handleCurrentTransaction = () => {
    setPendingCartItem(null);
    setCurrentPage('cart');
  };

  const handleNewTransaction = () => {
    store.clearCart();
    setPendingCartItem(null);
    setCartKey((k) => k + 1);
    setCurrentPage('cart');
  };

  const handleTestOrders = () => toast.info('Test Orders — Feature coming soon');

  const handleRefundStart = (orderId: string) => {
    setRefundOrderId(orderId);
    setCurrentPage('refund-order');
  };

  const handleRelabel = () => toast.info('Relabel — Feature coming soon');
  const handleReprintReceipt = () => toast.info('Reprint Receipt — Feature coming soon');
  const handleGiftVoucher = () => setCurrentPage('gift-voucher');
  const handlePriceRequest = () => toast.info('Price Request — Feature coming soon');
  const handleGiftReceipt = () => toast.info('Gift Receipt — Feature coming soon');
  const handleDonate = () => toast.info('Donate — Feature coming soon');

  // Adding items from search
  const handleAddToCurrentTransaction = (item: TransactionItem) => {
    store.addCartItem(transactionItemToCartItem(item));
    if (currentPage === 'cart') {
      setPendingCartItem(item);
    } else {
      setCurrentPage('cart');
    }
  };

  const handleAddToNewTransaction = (item: TransactionItem) => {
    store.clearCart();
    store.addCartItem(transactionItemToCartItem(item));
    setPendingCartItem(null);
    setCartKey((k) => k + 1);
    setCurrentPage('cart');
    toast.success(`Started new transaction with ${item.boxName}`);
  };

  // Save the current transaction as an unprocessed held order
  const handleSaveTransaction = (items: TransactionItem[]) => {
    const snapshot: CartItem[] = items.map((i) => ({ ...transactionItemToCartItem(i), id: i.id }));
    const saved = store.saveCart(snapshot);
    if (!saved) return;
    setPendingCartItem(null);
    setCartKey((k) => k + 1);
    toast.success('Transaction saved', {
      description: 'Saved to unprocessed transactions'
    });
  };

  // Restore a saved (unprocessed) transaction back into the cart
  const handleRestoreTransaction = (orderNumber: string) => {
    const restored = store.restoreSavedCart(orderNumber);
    if (restored) {
      setPendingCartItem(null);
      setCartKey((k) => k + 1);
      toast.success('Transaction restored to cart');
    }
    setShowHistory(false);
    setCurrentPage('cart');
  };

  // Customer handling
  const handleAttachCustomer = (customer: CustomerResult) => {
    store.setCustomerId(customer.id);
    if (currentPage === 'customer-profile') {
      setCurrentPage(previousPage === 'gift-voucher' ? 'gift-voucher' : 'home');
    } else if (currentPage !== 'cart' && currentPage !== 'gift-voucher') {
      setCurrentPage('cart');
    }
    setViewingCustomer(null);
    toast.success(`Customer attached: ${customer.name}`);
  };

  const handleCustomerSignup = (formData: any) => {
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    const isEmail = (formData.contactInfo || '').includes('@');
    store.addCustomer({
      name: name || 'New Customer',
      email: isEmail ? formData.contactInfo : '',
      phone: !isEmail ? formData.contactInfo : '',
      balance: 0,
      notes: ''
    });
    setShowNewCustomerModal(false);
    const created = useStore.getState().customers.find((c) => c.name === name);
    if (created) {
      setViewingCustomer(toCustomerResult(created));
      setPreviousPage(currentPage === 'gift-voucher' ? 'gift-voucher' : 'home');
      setCurrentPage('customer-profile');
    }
  };

  const handleViewCustomer = (customer: CustomerResult) => {
    setViewingCustomer(customer);
    setIsCustomerSearchActive(false);
    setPreviousPage('home');
    setCurrentPage('customer-profile');
  };

  const handleViewAllCustomers = () => {
    setIsCustomerSearchActive(false);
    setCurrentPage('customer-listing');
  };

  // Customer listing callbacks (receives the mock row shape)
  const handleCustomerClick = (customer: any) => {
    setViewingCustomer(toProfile(customer));
    setPreviousPage('customer-listing');
    setCurrentPage('customer-profile');
  };

  const handleListingAttach = (customer: any) => handleAttachCustomer(toProfile(customer));
  const handleListingTestOrder = (customer: any) => toast.info(`Creating test order for ${toProfile(customer).name}`);
  const handleListingRefund = (customer: any) => toast.info(`Starting refund for ${toProfile(customer).name}`);
  const handleListingGiftVoucher = (customer: any) => toast.info(`Issuing gift voucher for ${toProfile(customer).name}`);

  // Transaction completion → fresh transaction (as in the reference)
  const handleTransactionComplete = (payments: PaymentSplit[] = []) => {
    const cart = store.cart;
    if (cart.length > 0) {
      const net = Math.round(cart.reduce((s, c) => s + (c.type === 'buy' ? -1 : 1) * c.price * c.qty, 0) * 100) / 100;
      const owed = Math.max(0, net);
      const legs = payments.filter((p) => p.amount > 0);
      store.checkout(
        legs.length > 0
          ? legs
          : owed > 0
            ? [{ method: 'cash', amount: owed }]
            : [{ method: 'card', amount: 0 }]
      );
    }
    store.clearCart();
    setPendingCartItem(null);
    setCartKey((k) => k + 1);
    setCurrentPage('cart');
  };

  // Gift voucher
  const handleGiftVoucherProcess = (details: any) => {
    const voucher = store.issueGiftVoucher(details.amount, customerId);
    if (voucher) {
      toast.success('Gift Voucher Issued', {
        description: `${settings.currency}${details.amount.toFixed(2)} · ${voucher.code}`
      });
    }
    setCurrentPage('home');
    store.setCustomerId(undefined);
  };

  // Refund flow
  const handleRefundProceed = (details: any) => {
    setRefundDetails({
      orderId: details.orderId,
      amount: details.amount ?? 0,
      reason: 'Refund',
      subReason: '',
      items: details.items,
      method: 'card',
      receiptOptions: { print: true, email: false }
    });
    setCurrentPage('refund-checkout');
  };

  const handleRefundProcess = (method: string, receiptOptions: { print: boolean; email: boolean }) => {
    setRefundDetails((prev) => (prev ? { ...prev, method, receiptOptions } : prev));
    setShowAuthModal(true);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerTag.trim() || !refundDetails) return;

    const original = sales.find((s) => s.id === refundDetails.orderId);
    const fallback = sales.filter((s) => s.kind !== 'refund' && !s.refundedAt).slice(-1)[0];
    const sale = original ?? fallback;

    if (!sale) {
      toast.error('No order found to refund');
      setShowAuthModal(false);
      setManagerTag('');
      return;
    }

    const items: CartItem[] = [
      {
        id: `refund-${Date.now()}`,
        productId: sale.id,
        name: 'Refund',
        boxId: '',
        category: '',
        stockLevel: 1,
        type: 'sell',
        price: refundDetails.amount,
        qty: 1,
        requiresSerial: false
      }
    ];
    const method = REFUND_METHODS[refundDetails.method] ?? 'card';

    const res = store.refundSale(sale.id, items, [{ method, amount: refundDetails.amount }], managerTag);
    setManagerTag('');

    if (!res.ok) {
      toast.error(res.error ?? 'Refund failed');
      setShowAuthModal(false);
      return;
    }

    setShowAuthModal(false);
    setShowRefundSuccess(true);
    setTimeout(() => {
      setShowRefundSuccess(false);
      setRefundOrderId('');
      setRefundDetails(null);
      setCurrentPage('home');
    }, 3000);
  };

  // Confetti while the refund success overlay is visible
  useEffect(() => {
    if (!showRefundSuccess) return;
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
    const random = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
    return () => clearInterval(interval);
  }, [showRefundSuccess]);

  return (
    <div className="h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <Toaster
        position={currentPage === 'cart' ? 'bottom-left' : 'top-center'}
        richColors
        closeButton
        theme={theme}
        toastOptions={{
          className: 'rounded-none font-sans border-2 shadow-2xl',
          style: {
            marginTop: currentPage === 'cart' ? '0px' : '80px',
            marginBottom: currentPage === 'cart' ? '100px' : '0px',
            marginLeft: currentPage === 'cart' ? '24px' : '0px',
            borderRadius: '0px'
          },
          actionButtonStyle: { borderRadius: '0px' },
          cancelButtonStyle: { borderRadius: '0px' }
        }}
      />

      {/* Screen Saver */}
      {showScreenSaver && (
        <ScreenSaver branchName={settings.storeName} onNavigate={handleScreenSaverNavigate} />
      )}

      {/* Refund Success Overlay */}
      <AnimatePresence>
        {showRefundSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-card border border-primary/50 p-8 rounded-lg flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(178,105,68,0.3)] max-w-sm w-full mx-4"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-primary flex items-center justify-center relative z-10"
                >
                  <Check className="w-10 h-10 text-primary-foreground stroke-[3]" />
                </motion.div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 bg-primary/30 rounded-full z-0"
                />
              </div>
              <div className="text-center space-y-2">
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-black text-foreground uppercase tracking-wider"
                >
                  Refund Successful
                </motion.h2>
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-primary font-mono text-3xl font-bold"
                >
                  {settings.currency}
                  {(refundDetails?.amount ?? 0).toFixed(2)}
                </motion.div>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-muted-foreground text-xs"
                >
                  Refund has been processed via {refundDetails?.items ? 'Original Method' : 'Selected Method'}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manager Auth Modal */}
      <AnimatePresence>
        {showAuthModal && refundDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => setShowAuthModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative bg-card border border-border w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden"
            >
              <div className="bg-muted px-6 py-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Manager Authorization
                </h3>
                <button onClick={() => setShowAuthModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAuthSubmit} className="p-6">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30 animate-pulse">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center text-sm text-muted-foreground mb-4">
                    Please scan manager tag to authorize refund of{' '}
                    <span className="text-foreground font-bold">
                      {settings.currency}
                      {(refundDetails.amount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <input
                      autoFocus
                      type="password"
                      className="w-full h-12 px-4 bg-input border border-primary text-foreground text-center text-lg font-mono focus:border-primary focus:outline-none transition-colors placeholder:text-muted-foreground"
                      placeholder="SCAN TAG..."
                      value={managerTag}
                      onChange={(e) => setManagerTag(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={!managerTag}
                    className="w-full h-12 bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold uppercase tracking-wider text-sm transition-colors"
                  >
                    Authorize
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Navigation */}
      <TopNavigation
        currentFloat={currentFloat}
        customers={customerResults}
        boxes={boxResults}
        orders={orderResults}
        onOpenSidebar={() => setShowSidebar(true)}
        onAddCustomer={handleNewCustomer}
        onRecentTransactions={() => setShowHistory(true)}
        onCart={() => setCurrentPage('cart')}
        onChangeFloat={handleCloseBanking}
        isCartPage={currentPage === 'cart'}
        onNewTransaction={handleNewTransaction}
        onLogoClick={() => {
          setCurrentPage('home');
          setViewingCustomer(null);
        }}
        isCustomerSearchActive={isCustomerSearchActive}
        onDeactivateCustomerSearch={() => setIsCustomerSearchActive(false)}
        onAddToCurrentTransaction={handleAddToCurrentTransaction}
        onAddToNewTransaction={handleAddToNewTransaction}
        onAttachCustomer={handleAttachCustomer}
        onViewCustomer={handleViewCustomer}
        onViewAllCustomers={handleViewAllCustomers}
      />

      {/* Customer Search Overlay */}
      {isCustomerSearchActive && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsCustomerSearchActive(false)} />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        currentFloat={currentFloat}
        onCloseBanking={handleCloseBanking}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Page Content Routing */}
      {currentPage === 'home' && (
        <HomePage
          branchName={settings.storeName}
          todaysFigures={todaysFigures}
          onNewCustomer={handleNewCustomer}
          onCurrentTransaction={handleCurrentTransaction}
          onNewTransaction={handleNewTransaction}
          onTestOrders={handleTestOrders}
          onRefund={handleRefundStart}
          onRelabel={handleRelabel}
          onReprintReceipt={handleReprintReceipt}
          onGiftVoucher={handleGiftVoucher}
          onPriceRequest={handlePriceRequest}
          onGiftReceipt={handleGiftReceipt}
          onDonate={handleDonate}
        />
      )}

      {currentPage === 'cart' && (
        <CartPage
          key={cartKey}
          onBack={() => setCurrentPage('home')}
          onActivateCustomerSearch={() => {
            setIsCustomerSearchActive(true);
            setShowScreenSaver(false);
          }}
          initialItems={initialCartItems}
          pendingCartItem={pendingCartItem}
          setPendingCartItem={setPendingCartItem}
          selectedCustomer={selectedCustomer}
          onAttachCustomer={handleAttachCustomer}
          onTransactionComplete={handleTransactionComplete}
          onSaveTransaction={handleSaveTransaction}
        />
      )}

      {currentPage === 'customer-profile' && viewingCustomer && (
        <CustomerProfile
          customer={viewingCustomer}
          onAttachToTransaction={handleAttachCustomer}
          onBack={() => setCurrentPage(previousPage)}
        />
      )}

      {currentPage === 'customer-listing' && (
        <CustomerListing
          onBack={() => setCurrentPage('home')}
          onCustomerClick={handleCustomerClick}
          onAttachToTransaction={handleListingAttach}
          onTestOrder={handleListingTestOrder}
          onRefund={handleListingRefund}
          onGiftVoucher={handleListingGiftVoucher}
        />
      )}

      {currentPage === 'refund-order' && (
        <RefundOrder
          orderId={refundOrderId}
          onBack={() => setCurrentPage('home')}
          onProceed={handleRefundProceed}
        />
      )}

      {currentPage === 'refund-checkout' && refundDetails && (
        <RefundCheckout
          refundDetails={{
            orderId: refundDetails.orderId,
            amount: refundDetails.amount,
            reason: refundDetails.reason,
            subReason: refundDetails.subReason
          }}
          onBack={() => setCurrentPage('refund-order')}
          onProcess={handleRefundProcess}
        />
      )}

      {currentPage === 'gift-voucher' && (
        <GiftVoucherPage
          onBack={() => setCurrentPage('home')}
          onActivateCustomerSearch={() => {
            setIsCustomerSearchActive(true);
            setShowScreenSaver(false);
          }}
          onNewCustomer={handleNewCustomer}
          selectedCustomer={selectedCustomer}
          onProcess={handleGiftVoucherProcess}
        />
      )}

      {/* New Customer Modal */}
      <NewCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onSignup={handleCustomerSignup}
      />

      {/* Close Banking Confirmation */}
      <ConfirmDialog
        isOpen={showCloseBankingDialog}
        title="Close Banking"
        message="Are you sure you want to close banking? This will end your shift."
        confirmLabel="Close Banking"
        danger
        onCancel={() => setShowCloseBankingDialog(false)}
        onConfirm={handleConfirmCloseBanking}
      />

      {/* Order History Modal */}
      {showHistory && (
        <OrderHistory
          orders={processedTransactions}
          unprocessed={unprocessedTransactions}
          onClose={() => setShowHistory(false)}
          onRestoreTransaction={handleRestoreTransaction}
        />
      )}

      {/* Open Banking */}
      {!activeTill && <OpenBanking onComplete={handleOpenBanking} />}
    </div>
  );
}
