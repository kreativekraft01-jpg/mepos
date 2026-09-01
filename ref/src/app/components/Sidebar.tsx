import { X, Home, Settings, HelpCircle, LogOut, DollarSign, MessageSquare, BookOpen, Sparkles, Building2, ChevronDown, Sun, Moon, Keyboard } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentFloat: { amount: number; name: string } | null;
  onCloseBanking: () => void;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

const BRANCHES = [
  'CeX Watford',
  'CeX Harrow',
  'CeX London',
  'CeX Birmingham',
  'CeX Manchester'
];

export function Sidebar({ isOpen, onClose, currentFloat, onCloseBanking, theme = 'dark', onToggleTheme }: SidebarProps) {
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [currentBranch, setCurrentBranch] = useState('CeX Watford');
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  const handleBranchChange = (branch: string) => {
    setCurrentBranch(branch);
    setIsBranchDropdownOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Sidebar */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-sidebar z-50 border-r border-sidebar-border flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="bg-sidebar text-sidebar-foreground p-6 flex items-center justify-between border-b border-sidebar-border">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl font-black italic tracking-tighter text-sidebar-foreground relative"
                >
                  ME<span className="text-primary drop-shadow-[0_0_10px_rgba(219,115,55,0.5)]">PoS</span>
                  <div className="absolute -bottom-1 right-0 w-8 h-0.5 bg-primary/50"></div>
                </motion.div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-sidebar-accent rounded-none transition-colors group"
                >
                  <X className="w-6 h-6 text-muted-foreground group-hover:text-sidebar-foreground transition-transform group-hover:rotate-90" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto bg-sidebar">
                <nav className="p-4 space-y-2">
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    onClick={onClose}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-all text-left group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <Home className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Home</span>
                  </motion.button>

                  {/* Change Branch Dropdown */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }} 
                    className="relative"
                  >
                    <button
                      onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                      <div className="flex items-center gap-4">
                        <Building2 className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">
                          {currentBranch}
                        </span>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isBranchDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {isBranchDropdownOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          className="overflow-hidden bg-sidebar-accent/50 border-y border-sidebar-border"
                        >
                          {BRANCHES.map((branch) => (
                            <button
                              key={branch}
                              onClick={() => handleBranchChange(branch)}
                              className={`w-full flex items-center px-14 py-3 hover:bg-sidebar-accent transition-colors text-left text-base ${
                                currentBranch === branch ? 'text-primary font-bold' : 'text-muted-foreground hover:text-sidebar-foreground'
                              }`}
                            >
                              {branch}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                    onClick={onClose}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <Settings className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Settings</span>
                  </motion.button>

                  <div className="h-px bg-sidebar-border mx-4 my-2" />

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => {
                      onClose();
                      alert('Feedback form coming soon');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <MessageSquare className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Feedback</span>
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 }}
                    onClick={() => {
                      onClose();
                      alert('Beginners Guide coming soon');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <BookOpen className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Beginners Guide</span>
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={() => {
                      onClose();
                      alert('Whats New coming soon');
                    }}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <Sparkles className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">What's New</span>
                  </motion.button>

                  <div className="h-px bg-sidebar-border mx-4 my-2" />

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 }}
                    onClick={onClose}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <HelpCircle className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Help</span>
                  </motion.button>

                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => setShowKeyboardShortcuts(!showKeyboardShortcuts)}
                    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-sidebar-accent rounded-none transition-colors text-left group relative"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
                    <Keyboard className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground transition-colors">Keyboard Shortcuts</span>
                  </motion.button>
                </nav>
              </div>

              {/* Footer */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="border-t border-sidebar-border p-4 space-y-3 bg-sidebar"
              >
                {/*HZ Current Float Info */}
                {currentFloat && (
                  <div className="bg-card border border-sidebar-border rounded-none p-4 shadow-lg">
                    <div className="text-sm text-muted-foreground mb-1 font-bold uppercase tracking-wider">Current Float</div>
                    <div className="text-lg text-sidebar-foreground font-bold">{currentFloat.name}</div>
                    
                  </div>
                )}

                {/* Theme Toggle */}
                {onToggleTheme && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onToggleTheme}
                    className="w-full flex items-center gap-4 px-4 py-4 bg-card hover:bg-sidebar-accent text-sidebar-foreground rounded-none transition-colors text-left border border-sidebar-border group"
                  >
                    {theme === 'dark' ? (
                       <Sun className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    ) : (
                       <Moon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                    <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground">
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </motion.button>
                )}

                {/* Close Banking */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onCloseBanking}
                  className="w-full flex items-center gap-4 px-4 py-4 bg-primary hover:brightness-110 text-primary-foreground rounded-none transition-colors text-left shadow-[0_0_15px_rgba(219,115,55,0.1)] hover:shadow-[0_0_20px_rgba(219,115,55,0.3)]"
                >
                  <DollarSign className="w-6 h-6" />
                  <span className="text-lg font-semibold font-normal">Close Banking</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full flex items-center gap-4 px-4 py-4 bg-card hover:bg-sidebar-accent text-sidebar-foreground rounded-none transition-colors text-left border border-sidebar-border group"
                >
                  <LogOut className="w-6 h-6 text-muted-foreground group-hover:text-sidebar-foreground" />
                  <span className="text-lg font-bold text-sidebar-foreground group-hover:text-sidebar-foreground">Log Out</span>
                </motion.button>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Keyboard Shortcuts Modal */}
      <AnimatePresence>
        {showKeyboardShortcuts && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKeyboardShortcuts(false)}
              className="absolute inset-0 bg-background/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative bg-card border border-border shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="bg-muted/40 px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-primary" />
                  Keyboard Shortcuts
                </h3>
                <button
                  onClick={() => setShowKeyboardShortcuts(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors hover:rotate-90 duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-6">
                  {/* Home Page */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Home Page</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["N"]} description="New Transaction" />
                      <ShortcutItem keys={["U"]} description="New User/Customer" />
                      <ShortcutItem keys={["C"]} description="Current Transaction" />
                      <ShortcutItem keys={["R"]} description="Open Refund" />
                      <ShortcutItem keys={["T"]} description="Test Orders" />
                      <ShortcutItem keys={["G"]} description="Gift Voucher" />
                      <ShortcutItem keys={["P"]} description="Price Request" />
                      <ShortcutItem keys={["Esc"]} description="Close modal" />
                    </div>
                  </div>

                  {/* Cart Page */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Cart / Transaction Page</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["Esc"]} description="Go back to home" />
                      <ShortcutItem keys={["S"]} description="Search/Add Customer" />
                      <ShortcutItem keys={["Enter"]} description="Proceed to payment" />
                      <ShortcutItem keys={["Delete"]} description="Remove selected items" />
                      <ShortcutItem keys={["Ctrl", "A"]} description="Toggle select all items" />
                    </div>
                  </div>

                  {/* Customer Profile */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Customer Profile</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["Esc"]} description="Go back" />
                      <ShortcutItem keys={["A"]} description="Attach to transaction" />
                    </div>
                  </div>

                  {/* Refund */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Refund Pages</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["Esc"]} description="Go back" />
                      <ShortcutItem keys={["Ctrl", "A"]} description="Select/deselect all items" />
                      <ShortcutItem keys={["Enter"]} description="Proceed to checkout" />
                      <ShortcutItem keys={["C"]} description="Cash payment" />
                      <ShortcutItem keys={["B"]} description="Bank transfer" />
                      <ShortcutItem keys={["V"]} description="Voucher" />
                      <ShortcutItem keys={["P"]} description="Toggle print receipt" />
                      <ShortcutItem keys={["E"]} description="Toggle email receipt" />
                    </div>
                  </div>

                  {/* Gift Voucher */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Gift Voucher Page</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["Esc"]} description="Go back" />
                      <ShortcutItem keys={["S"]} description="Search/Add Customer" />
                      <ShortcutItem keys={["U"]} description="New Customer" />
                      <ShortcutItem keys={["Enter"]} description="Process payment" />
                      <ShortcutItem keys={["P"]} description="Toggle print receipt" />
                      <ShortcutItem keys={["E"]} description="Toggle email receipt" />
                    </div>
                  </div>

                  {/* Customer Listing */}
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Customer Listing</h4>
                    <div className="space-y-2">
                      <ShortcutItem keys={["Esc"]} description="Go back" />
                      <ShortcutItem keys={["F"]} description="Cycle through filters" />
                      <ShortcutItem keys={["/"]} description="Focus search" />
                      <ShortcutItem keys={["S"]} description="Focus search" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper component for keyboard shortcut items
function ShortcutItem({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 transition-colors rounded-none">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index} className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-background border border-border rounded-none text-xs font-mono text-foreground font-semibold shadow-sm min-w-[2rem] text-center">
              {key}
            </kbd>
            {index < keys.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
          </span>
        ))}
      </div>
    </div>
  );
}