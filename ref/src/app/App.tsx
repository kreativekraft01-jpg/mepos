import { useState, useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, X, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

// Import components
import { OpenBanking } from './components/OpenBanking';
import { TopNavigation } from './components/TopNavigation';
import { Sidebar } from './components/Sidebar';
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
import type { TransactionItem } from './types';
import { MOCK_CUSTOMER_RESULTS } from './components/SearchResults';
import type { CustomerResult } from './components/SearchResults';

interface Order {
  id: string;
  customer: string;
  amount: number;
  items: number;
  timestamp: string;
}

export default function App() {
  const [isBankingOpen, setIsBankingOpen] = useState(false);
  const [startingFloat, setStartingFloat] = useState<{ amount: number; name: string } | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showScreenSaver, setShowScreenSaver] = useState(true);
  
  // Updated currentPage type to include refund pages, customer listing and gift voucher
  const [currentPage, setCurrentPage] = useState<'home' | 'cart' | 'customer-profile' | 'customer-listing' | 'refund-order' | 'refund-checkout' | 'gift-voucher'>('home');
  const [previousPage, setPreviousPage] = useState<'home' | 'customer-listing' | 'gift-voucher'>('home');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isCustomerSearchActive, setIsCustomerSearchActive] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  
  // Refund Flow State
  const [refundOrderId, setRefundOrderId] = useState('');
  const [refundDetails, setRefundDetails] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [managerTag, setManagerTag] = useState('');
  const [showRefundSuccess, setShowRefundSuccess] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Handle theme change
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // This state now holds the customer being viewed on the 'customer-profile' page
  const [viewingCustomer, setViewingCustomer] = useState<CustomerResult | null>(null);
  
  const [cartKey, setCartKey] = useState(0);
  const [pendingCartItem, setPendingCartItem] = useState<TransactionItem | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [currentTransactionItems, setCurrentTransactionItems] = useState<TransactionItem[]>([]);
  const [customers, setCustomers] = useState<CustomerResult[]>(MOCK_CUSTOMER_RESULTS);
  
  const [todaysFigures, setTodaysFigures] = useState({
    sales: 1250.50,
    buys: 850.00,
    exchange: 420.25,
    refunds: 125.00,
  });

  const idleTimer = useRef<any>(null);

  // Idle detection: 60 seconds
  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (!showScreenSaver) {
      idleTimer.current = setTimeout(() => {
        setShowScreenSaver(true);
      }, 60000);
    }
  };

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    const handleActivity = () => resetIdleTimer();

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetIdleTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [showScreenSaver]);

  // Handle open banking
  const handleOpenBanking = (amount: number, floatName: string) => {
    setStartingFloat({ amount, name: floatName });
    setIsBankingOpen(true);
    setShowScreenSaver(false);
    toast.success(`Register opened with ${floatName} (£${amount.toFixed(2)})`, {
      duration: 3000,
    });
  };

  const handleScreenSaverNavigate = (target: 'home' | 'cart') => {
    setCurrentPage(target);
    setShowScreenSaver(false);
  };

  // Handle close banking
  const handleCloseBanking = () => {
    const confirmClose = window.confirm(
      'Are you sure you want to close banking? This will end your shift.'
    );
    if (confirmClose) {
      setIsBankingOpen(false);
      setStartingFloat(null);
      setShowSidebar(false);
      setShowScreenSaver(true);
      toast.info('Banking closed. Please start a new shift.', {
        duration: 3000,
      });
    }
  };

  // Placeholder handlers for home page actions
  const handleNewCustomer = () => {
    setShowNewCustomerModal(true);
  };

  const handleCurrentTransaction = () => {
    // Mock items for current transaction
    const mockItems: TransactionItem[] = [
      {
        id: '1',
        boxName: 'iPhone 14 Pro 256GB Space Black',
        stockLevel: 3,
        category: 'Computing / Mobile Phones',
        boxId: '9876543',
        type: 'sell',
        price: 799.00,
        qty: 1,
        requiresSerial: true,
      },
      {
        id: '2',
        boxName: 'PlayStation 5 Console',
        stockLevel: 5,
        category: 'Gaming / PlayStation',
        boxId: '5551234',
        type: 'sell',
        price: 449.00,
        qty: 1,
        requiresSerial: false,
      },
      {
        id: '3',
        boxName: 'Call of Duty: Modern Warfare III',
        stockLevel: 8,
        category: 'Gaming / PlayStation',
        boxId: '1234567',
        type: 'sell',
        price: 3.00,
        qty: 1,
        requiresSerial: false,
      },
      {
        id: '4',
        boxName: 'Xbox Series X',
        stockLevel: 4,
        category: 'Gaming / Xbox',
        boxId: '8881234',
        type: 'buy',
        price: 350.00,
        qty: 1,
        requiresSerial: true,
      },
      {
        id: '5',
        boxName: 'iPad Air 5th Gen 64GB',
        stockLevel: 6,
        category: 'Computing / Tablets',
        boxId: '7771234',
        type: 'buy',
        price: 100.00,
        qty: 1,
        requiresSerial: true,
      },
      {
        id: '6',
        boxName: 'Nintendo Switch OLED',
        stockLevel: 7,
        category: 'Gaming / Nintendo',
        boxId: '6661234',
        type: 'exchange',
        price: 299.99,
        qty: 1,
        requiresSerial: true,
      },
      {
        id: '7',
        boxName: 'AirPods Pro 2nd Gen',
        stockLevel: 12,
        category: 'Audio / Headphones',
        boxId: '5551234',
        type: 'sell',
        price: 199.00,
        qty: 2,
        requiresSerial: false,
      },
      {
        id: '8',
        boxName: 'Samsung Galaxy S23 Ultra 256GB',
        stockLevel: 3,
        category: 'Computing / Mobile Phones',
        boxId: '4441234',
        type: 'sell',
        price: 650.00,
        qty: 1,
        requiresSerial: true,
      },
    ];
    
    setCurrentTransactionItems(mockItems);
    setCurrentPage('cart');
  };

  const handleNewTransaction = () => {
    setCurrentTransactionItems([]); // Clear current transaction items
    setSelectedCustomer(null); // Clear selected customer
    setCurrentPage('cart');
    setCartKey(prev => prev + 1); // Force remount CartPage to reset state
  };

  const handleTestOrders = () => {
    toast.info('Test Orders - Feature coming soon');
  };

  const handleRefundStart = (orderId: string) => {
    setRefundOrderId(orderId);
    setCurrentPage('refund-order');
    toast.info(`Looking up order ${orderId}...`);
  };

  const handleRefundProceed = (details: any) => {
    setRefundDetails(details);
    setCurrentPage('refund-checkout');
  };

  const handleRefundProcess = (method: string, receiptOptions: any) => {
    // Show auth modal
    setShowAuthModal(true);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (managerTag) {
      // Success!
      setShowAuthModal(false);
      setManagerTag('');
      // setRefundOrderId(''); // Keep for success display
      // setRefundDetails(null); // Keep for success display
      
      // Update figures (mock)
      setTodaysFigures(prev => ({
        ...prev,
        refunds: prev.refunds + (refundDetails?.amount || 0)
      }));
      
      // Show success animation
      setShowRefundSuccess(true);
      
      // Navigate away after animation
      setTimeout(() => {
         setShowRefundSuccess(false);
         setRefundOrderId('');
         setRefundDetails(null);
         setCurrentPage('home');
      }, 3000);
    }
  };

  // Confetti effect for refund success
  useEffect(() => {
    if (showRefundSuccess) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const random = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: random(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: random(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [showRefundSuccess]);

  const handleRelabel = () => {
    toast.info('Relabel - Feature coming soon');
  };

  const handleReprintReceipt = () => {
    toast.info('Reprint Receipt - Feature coming soon');
  };

  const handleGiftVoucher = () => {
    setCurrentPage('gift-voucher');
  };

  const handleGiftVoucherProcess = (details: any) => {
    toast.success('Gift Voucher Processed', {
      description: `£${details.amount.toFixed(2)} - ${details.paymentMethod}`,
      duration: 5000
    });
    setCurrentPage('home');
    setSelectedCustomer(null);
  };

  const handlePriceRequest = () => {
    toast.info('Price Request - Feature coming soon');
  };

  const handleGiftReceipt = () => {
    toast.info('Gift Receipt - Feature coming soon');
  };

  const handleDonate = () => {
    toast.info('Donate - Feature coming soon');
  };

  const handleAddCustomer = () => {
    setShowNewCustomerModal(true);
  };

  const handleCart = () => {
    setCurrentPage('cart');
  };

  const handleChangeFloat = () => {
    setIsBankingOpen(false);
  };

  const handleLogoClick = () => {
    setCurrentPage('home');
    setViewingCustomer(null);
  };

  // Handle adding item from search to current transaction
  const handleAddToCurrentTransaction = (item: TransactionItem) => {
    if (currentPage !== 'cart') {
      setCurrentPage('cart');
    }
    setPendingCartItem(item);
  };

  // Handle adding item from search to new transaction
  const handleAddToNewTransaction = (item: TransactionItem) => {
    setCartKey(prev => prev + 1); // Create new cart
    setCurrentPage('cart');
    setPendingCartItem(item);
    toast.success(`Started new transaction with ${item.boxName}`);
  };

  // Handle attaching customer to current transaction
  const handleAttachCustomer = (customer: CustomerResult) => {
    setSelectedCustomer(customer);
    
    // If we are on gift voucher page, stay there
    if (currentPage !== 'gift-voucher') {
      // If we are coming from customer profile and previous page was gift voucher, go back there
      if (currentPage === 'customer-profile' && previousPage === 'gift-voucher') {
        setCurrentPage('gift-voucher');
      } else {
        setCurrentPage('cart');
      }
    }
    
    setViewingCustomer(null); // Clear viewing customer if we are navigating away from profile
  };

  // Handle new customer signup
  const handleCustomerSignup = (formData: any) => {
    // Create new customer
    const newId = (customers.length + 1).toString();
    const isEmail = formData.contactInfo.includes('@');
    const newCustomer: CustomerResult = {
      id: newId,
      name: `${formData.firstName} ${formData.lastName}`,
      email: isEmail ? formData.contactInfo : '',
      phone: !isEmail ? formData.contactInfo : '',
      loyaltyPoints: 0,
    };
    
    setCustomers(prev => [...prev, newCustomer]);
    setShowNewCustomerModal(false);
    
    // Navigate to customer profile page
    setViewingCustomer(newCustomer);
    setPreviousPage(currentPage === 'gift-voucher' ? 'gift-voucher' : 'home');
    setCurrentPage('customer-profile');
    
    console.log('Created new customer:', newCustomer);
  };

  // Handle viewing customer from search
  const handleViewCustomer = (customer: CustomerResult) => {
    setViewingCustomer(customer);
    setIsCustomerSearchActive(false);
    setPreviousPage('home');
    setCurrentPage('customer-profile');
  };

  // Handle viewing all customers
  const handleViewAllCustomers = () => {
    setIsCustomerSearchActive(false);
    setCurrentPage('customer-listing');
  };

  // Handle customer click from listing
  const handleCustomerClick = (customer: any) => {
    // Convert to CustomerResult if needed, or update ViewingCustomer type
    // For now, mapping minimal fields
    const customerResult: CustomerResult = {
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: customer.mobile,
      loyaltyPoints: 0 // Mock points
    };
    setViewingCustomer(customerResult);
    setPreviousPage('customer-listing');
    setCurrentPage('customer-profile');
  };

  // Handlers for listing actions
  const handleListingAttach = (customer: any) => {
    const customerResult: CustomerResult = {
      id: customer.id,
      name: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      phone: customer.mobile,
      loyaltyPoints: 0
    };
    handleAttachCustomer(customerResult);
  };

  const handleListingTestOrder = (customer: any) => {
    toast.info(`Creating test order for ${customer.firstName} ${customer.lastName}`);
  };

  const handleListingRefund = (customer: any) => {
    toast.info(`Starting refund for ${customer.firstName} ${customer.lastName}`);
  };

  const handleListingGiftVoucher = (customer: any) => {
    toast.info(`Issuing gift voucher for ${customer.firstName} ${customer.lastName}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
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
            borderRadius: '0px',
          },
          actionButtonStyle: {
            borderRadius: '0px',
          },
          cancelButtonStyle: {
            borderRadius: '0px',
          },
        }}
      />

      {/* Screen Saver */}
      {showScreenSaver && (
        <ScreenSaver 
          branchName="CeX Watford" 
          onNavigate={handleScreenSaverNavigate} 
        />
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
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-card border border-primary/50 p-8 rounded-lg flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(178,105,68,0.3)] max-w-sm w-full mx-4"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
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
                  £{refundDetails?.amount.toFixed(2)}
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

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
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
                <button
                  onClick={() => setShowAuthModal(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
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
                     Please scan manager tag to authorize refund of <span className="text-foreground font-bold">£{refundDetails?.amount.toFixed(2)}</span>
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
        currentFloat={startingFloat}
        customers={customers}
        onOpenSidebar={() => setShowSidebar(true)}
        onAddCustomer={handleAddCustomer}
        onRecentTransactions={() => setShowHistory(true)}
        onCart={handleCart}
        onChangeFloat={handleChangeFloat}
        isCartPage={currentPage === 'cart'}
        onNewTransaction={handleNewTransaction}
        onLogoClick={handleLogoClick}
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
        <div 
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setIsCustomerSearchActive(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        currentFloat={startingFloat}
        onCloseBanking={handleCloseBanking}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Page Content Routing */}
      {currentPage === 'home' && (
        <HomePage
          branchName="Cex Watford"
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
          onBack={() => setCurrentPage('home')}
          onActivateCustomerSearch={() => setIsCustomerSearchActive(true)}
          key={cartKey}
          initialItems={currentTransactionItems}
          pendingCartItem={pendingCartItem}
          setPendingCartItem={setPendingCartItem}
          selectedCustomer={selectedCustomer}
          onAttachCustomer={handleAttachCustomer}
          onTransactionComplete={handleNewTransaction}
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
          refundDetails={refundDetails}
          onBack={() => setCurrentPage('refund-order')}
          onProcess={handleRefundProcess}
        />
      )}

      {currentPage === 'gift-voucher' && (
        <GiftVoucherPage 
          onBack={() => setCurrentPage('home')}
          onActivateCustomerSearch={() => setIsCustomerSearchActive(true)}
          onNewCustomer={() => setShowNewCustomerModal(true)}
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

      {/* Order History Modal */}
      {showHistory && (
        <OrderHistory orders={orders} onClose={() => setShowHistory(false)} />
      )}

      {/* Open Banking Modal */}
      {!isBankingOpen && (
        <OpenBanking 
          onComplete={handleOpenBanking} 
          onClose={startingFloat ? () => setIsBankingOpen(true) : undefined}
        />
      )}
    </div>
  );
}