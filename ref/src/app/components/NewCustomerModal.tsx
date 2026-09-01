import { X, User, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignup: (customer: any) => void;
}

export function NewCustomerModal({ isOpen, onClose, onSignup }: NewCustomerModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    contactInfo: '',
    optIn: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.contactInfo) {
      toast.error('Please fill in all required fields (Name and Email/Mobile)');
      return;
    }

    // Call onSignup with the form data. 
    // The parent component is responsible for closing the modal and navigating.
    onSignup(formData);
    
    toast.success(`Customer ${formData.firstName} ${formData.lastName} created successfully!`);
    setFormData({ firstName: '', lastName: '', contactInfo: '', optIn: false });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-card rounded-none shadow-2xl w-full max-w-xl overflow-hidden border-2 border-border"
          >
            {/* Header */}
            <div className="bg-muted px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-none">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">New Customer Signup</h2>
                  <p className="text-muted-foreground text-sm">Create a new customer profile</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-background rounded-none transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* First Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-none focus:border-primary focus:outline-none text-lg text-foreground transition-colors placeholder:text-muted-foreground"
                  />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 bg-background border-2 border-border rounded-none focus:border-primary focus:outline-none text-lg text-foreground transition-colors placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Email or Mobile */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  Email or Mobile Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  placeholder="Enter email or mobile number"
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-none focus:border-primary focus:outline-none text-lg text-foreground transition-colors placeholder:text-muted-foreground"
                />
              </div>

              {/* Marketing Opt-in */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, optIn: !formData.optIn })}
                className="flex items-center gap-3 w-full p-4 rounded-none hover:border-primary/50 hover:bg-muted transition-all text-left group px-0 py-4"
              >
                {formData.optIn ? (
                  <CheckSquare className="w-6 h-6 text-primary" />
                ) : (
                  <Square className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                )}
                <span className="text-foreground font-medium select-none">
                  Opt-in customer for marketing communication (optional)
                </span>
              </button>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 border-2 border-border rounded-none text-muted-foreground font-bold hover:bg-muted hover:text-foreground transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-4 bg-primary hover:brightness-110 text-primary-foreground rounded-none font-bold transition-all shadow-lg active:scale-95 uppercase tracking-widest"
                >
                  Create Customer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}