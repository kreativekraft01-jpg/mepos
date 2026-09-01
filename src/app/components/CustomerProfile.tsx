import { useState, useEffect } from 'react';
import { 
  User, MapPin, CreditCard, Shield, 
  Activity, CheckCircle, 
  Printer, History, 
  Eye, EyeOff, Plus, AlertCircle, Lock,
  MessageSquare, X, Calendar, Clock,
  MoreHorizontal, Trash2, Edit2, Check, ChevronDown, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CustomerResult } from './SearchResults';
import { toast } from 'sonner';

interface CustomerProfileProps {
  customer: CustomerResult | null;
  onAttachToTransaction: (customer: CustomerResult) => void;
  onBack: () => void;
}

interface Note {
  id: string;
  content: string;
  author: string;
  date: string;
}

interface Address {
  id: string;
  label: string; // e.g. "Home", "Work"
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isVerified: boolean;
}

// Extended customer data
interface ExtendedCustomer extends CustomerResult {
  title: string;
  firstName: string;
  surname: string;
  membershipCardNumber?: string;
  status: 'Active' | 'Inactive' | 'Banned';
  guardianApproval: boolean;
  
  memberSince: string;
  dob: string;
  
  addresses: Address[];
  
  // ID Details
  idType: string;
  idSubtype: string;
  idNumber: string;
  
  // Bank Details
  accountHolderName: string;
  accountNumber: string;
  sortCode: string;
  rollNumber?: string;
  
  // Visit History
  lastStoreVisit: string;
  lastOnlineVisit: string;
  
  notes: Note[];
  verificationLevel: 'None' | 'Basic' | 'Full';
  hasProofOfId: boolean;
  hasBankDetails: boolean;
}

const getExtendedData = (base: CustomerResult): ExtendedCustomer => {
  const names = base.name.split(' ');
  return {
    ...base,
    title: 'Mr',
    firstName: names[0] || '',
    surname: names.slice(1).join(' ') || '',
    status: 'Active',
    membershipCardNumber: '9988776655',
    guardianApproval: false,
    memberSince: '2022-03-15',
    dob: '1990-06-24',
    addresses: [
      {
        id: '1',
        label: 'Home',
        line1: '42 High Street',
        city: 'Watford',
        postcode: 'WD17 2DJ',
        isVerified: true
      },
      {
        id: '2',
        label: 'Work',
        line1: 'Unit 5, Business Park',
        line2: 'Clarendon Road',
        city: 'Watford',
        postcode: 'WD17 1JJ',
        isVerified: false
      }
    ],
    idType: 'Driving Licence',
    idSubtype: 'UK Full',
    idNumber: 'SMITH706245SM9CC',
    accountHolderName: base.name,
    accountNumber: '********',
    sortCode: '20-00-00',
    rollNumber: '',
    lastStoreVisit: '2025-04-23 14:25:58',
    lastOnlineVisit: '2025-04-20 09:12:44',
    
    notes: [
      {
        id: '1',
        content: 'Customer prefers email receipts. Always checks condition of items thoroughly.',
        author: 'System',
        date: '2023-11-15 14:30'
      },
      {
        id: '2',
        content: 'Brought in a PS5 for trade-in. Box was missing manual.',
        author: 'Sarah J',
        date: '2024-01-10 09:45'
      }
    ],
    verificationLevel: 'Full',
    hasProofOfId: true,
    hasBankDetails: false,
  };
};

type Tab = 'summary' | 'general' | 'address' | 'id' | 'payment' | 'other';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'summary', label: 'Summary', icon: Activity },
  { id: 'general', label: 'General', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'id', label: 'ID & Verification', icon: Shield },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
];

export function CustomerProfile({ customer, onAttachToTransaction, onBack }: CustomerProfileProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [newNote, setNewNote] = useState('');
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [visibleAddressIds, setVisibleAddressIds] = useState<Set<string>>(new Set());
  
  // Initialize state directly to avoid render cycle issues
  const [customerData, setCustomerData] = useState<ExtendedCustomer | null>(() => 
    customer ? getExtendedData(customer) : null
  );
  
  // Visibility states for summary view
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({
    name: true,
    id: true,
    email: false,
    phone: false,
    address: false
  });

  // Update data if customer prop changes
  useEffect(() => {
    if (customer) {
      setCustomerData(prev => {
        // Only update if ID changes to prevent loops
        if (prev?.id === customer.id) return prev;
        return getExtendedData(customer);
      });
    }
  }, [customer]);

  const toggleVisibility = (field: string) => {
    setVisibleFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const toggleAddressVisibility = (id: string) => {
    setVisibleAddressIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const verifyAddress = (id: string) => {
    if (!customerData) return;
    setCustomerData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        addresses: prev.addresses.map(addr => 
          addr.id === id ? { ...addr, isVerified: !addr.isVerified } : addr
        )
      };
    });
    toast.success('Address verification status updated');
  };

  const handleUpdate = () => {
    toast.success('Customer profile updated successfully');
  };

  const handleReset = () => {
    if (customer) {
      setCustomerData(getExtendedData(customer));
      toast.info('Changes discarded');
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !customerData) return;

    const note: Note = {
      id: Date.now().toString(),
      content: newNote,
      author: 'You', // In a real app, this would be the logged-in user
      date: new Date().toLocaleString('en-GB', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };

    setCustomerData(prev => prev ? ({
      ...prev,
      notes: [note, ...prev.notes]
    }) : null);

    setNewNote('');
    setIsNoteModalOpen(false);
    toast.success('Note added to customer profile');
  };
  
  if (!customerData) return null;

  // Requirements & Abilities Configuration
  const requirements = [
    { id: 'name', label: 'Name', fullLabel: 'Full Name', met: !!customerData.name, tab: 'general' as Tab },
    { id: 'email', label: 'Email', fullLabel: 'Email Address', met: !!customerData.email, tab: 'general' as Tab },
    { id: 'phone', label: 'Mobile', fullLabel: 'Mobile Number', met: !!customerData.phone, tab: 'general' as Tab },
    { id: 'address', label: 'Address', fullLabel: 'Full Address', met: customerData.addresses.length > 0, tab: 'address' as Tab },
    { id: 'dob', label: 'DOB', fullLabel: 'Date of Birth', met: !!customerData.dob, tab: 'general' as Tab },
    { id: 'id', label: 'ID', fullLabel: 'Proof of ID', met: customerData.hasProofOfId, tab: 'id' as Tab },
    { id: 'bank', label: 'Bank', fullLabel: 'Bank Details', met: customerData.hasBankDetails, tab: 'payment' as Tab },
  ];

  const abilities = [
    { id: 'voucher', label: 'Voucher', reqs: ['name', 'email', 'phone', 'address', 'dob', 'id'] },
    { id: 'bank', label: 'Bank Transfer', reqs: ['name', 'email', 'phone', 'address', 'dob', 'id', 'bank'] },
    { id: 'cash', label: 'Cash', reqs: ['name', 'email', 'phone', 'address', 'dob', 'id'] },
    { id: 'mobile', label: 'Sell Mobile', reqs: ['name', 'email', 'phone', 'address', 'dob', 'id'] }
  ];

  const DetailField = ({ 
    id, 
    label, 
    value, 
    isMono = false,
    className = ""
  }: { 
    id: string; 
    label: string; 
    value: string; 
    isMono?: boolean;
    className?: string;
  }) => {
    const isVisible = visibleFields[id];
    
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center h-6">
          <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{label}</label>
          <button 
            onClick={() => toggleVisibility(id)}
            className="w-10 h-10 flex items-center justify-center -mr-2 text-neutral-600 hover:text-foreground active:scale-95 transition-all"
            aria-label={isVisible ? "Hide details" : "Show details"}
          >
            {isVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <div className={`text-sm text-foreground ${isMono ? 'font-mono' : ''} truncate min-h-[20px]`}>
          {isVisible ? value : '••••••••••••••••'}
        </div>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="flex flex-col gap-6">
      
      {/* 1. Membership Details - Single Unified Section */}
      <div className="bg-card border border-border p-4 md:p-5 relative overflow-hidden group">
         {/* Decorative status strip */}
         <div className={`absolute top-0 left-0 w-1 h-full ${customerData.status === 'Active' ? 'bg-primary' : 'bg-red-500'}`} />
         
         <div className="flex items-center justify-between mb-4 pl-3">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
               Member Details
               <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                 customerData.status === 'Active' 
                   ? 'bg-primary/10 text-primary' 
                   : 'bg-red-500/10 text-red-500'
               }`}>
                 {customerData.status}
               </span>
            </h3>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-muted text-neutral-400 hover:text-foreground rounded transition-colors" title="Print Label">
                <Printer className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-muted text-neutral-400 hover:text-foreground rounded transition-colors" title="History">
                <History className="w-5 h-5" />
              </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pl-3">
             <DetailField id="name" label="Full Name" value={customerData.name} />
             <DetailField id="email" label="Email" value={customerData.email} />
             <DetailField id="phone" label="Mobile" value={customerData.phone} />
             <DetailField id="id" label="Membership ID" value={customerData.id} isMono />
             <div className="md:col-span-2 lg:col-span-4 pt-2 border-t border-border mt-2">
                <DetailField 
                  id="address" 
                  label="Address" 
                  value={customerData.addresses[0] ? `${customerData.addresses[0].line1}, ${customerData.addresses[0].city}` : 'No Address'} 
                />
             </div>
         </div>
      </div>

      {/* 2. Abilities Matrix */}
      <div className="bg-card border border-border flex flex-col overflow-hidden">
         <div className="p-3 border-b border-border bg-muted flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
               Verification & Abilities Matrix
            </h3>
            
            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[12px] font-bold text-neutral-500 uppercase">Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 bg-red-500/10 border border-red-500/50 rounded flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-red-500" />
                </div>
                <span className="text-[12px] font-bold text-neutral-500 uppercase">Required</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 bg-muted border border-border rounded flex items-center justify-center">
                  <Plus className="w-2.5 h-2.5 text-neutral-400" />
                </div>
                <span className="text-[12px] font-bold text-neutral-500 uppercase leading-tight">Optional</span>
              </div>
            </div>
         </div>
         
         {/* Matrix Header */}
         <div className="grid grid-cols-[140px_repeat(7,1fr)] bg-secondary border-b border-border">
            <div className="p-3 flex items-left justify-between border-r border-border"></div> {/* Corner */}
            {requirements.map(req => (
              <div key={req.id} className="p-2 py-3 text-[12px] md:text-[14px] font-medium text-neutral-400 tracking-widest text-center border-r last:border-0 border-border flex items-center justify-center">
                {req.label}
              </div>
            ))}
         </div>
         
         {/* Matrix Body */}
         <div>
            {abilities.map((ability) => {
              const isLocked = ability.reqs.some(reqId => {
                const r = requirements.find(x => x.id === reqId);
                return r && !r.met;
              });
              
              return (
                <div key={ability.id} className="grid grid-cols-[140px_repeat(7,1fr)] border-b last:border-0 border-border hover:bg-muted/50 transition-colors group">
                  {/* Row Header: Ability */}
                  <div className="p-3 flex items-left justify-between border-r border-border bg-secondary group-hover:bg-muted transition-colors">
                    <span className={`text-[14px] font-medium tracking-wide ${!isLocked ? 'text-foreground' : 'text-neutral-400'}`}>
                      {ability.label}
                    </span>
                    {isLocked && <Lock className="w-3 h-3 text-neutral-600 shrink-0" />}
                  </div>
                  
                  {/* Row Cells: Requirements */}
                  {requirements.map((req) => {
                     const isRequired = ability.reqs.includes(req.id);
                     const isMet = req.met;
                     
                     return (
                       <div key={req.id} className="border-r last:border-0 border-border flex flex-col items-center justify-center p-2 relative h-12">
                          {isMet ? (
                            // VERIFIED
                            <div className="flex flex-col items-center justify-center h-full w-full">
                               <CheckCircle className={`w-6 h-6 ${isRequired ? 'text-emerald-500' : 'text-emerald-500/40'}`} />
                            </div>
                          ) : isRequired ? (
                            // MANDATORY & MISSING
                            <button 
                              onClick={() => setActiveTab(req.tab)}
                              className="flex flex-col items-center justify-center w-full h-full group/btn"
                              aria-label={`Add required ${req.label}`}
                            >
                               <div className="w-8 h-8 bg-red-500/10 border border-red-500/50 rounded flex items-center justify-center group-hover/btn:bg-red-500 group-hover/btn:text-black text-red-500 transition-colors">
                                  <Plus className="w-5 h-5" />
                                </div>
                            </button>
                          ) : (
                            // OPTIONAL & MISSING
                            <button 
                              onClick={() => setActiveTab(req.tab)}
                              className="flex flex-col items-center justify-center w-full h-full group/btn opacity-40 hover:opacity-100 transition-opacity"
                              aria-label={`Add optional ${req.label}`}
                            >
                               <div className="w-6 h-6 bg-[#2A2F34] border border-neutral-600 rounded flex items-center justify-center group-hover/btn:border-primary group-hover/btn:text-primary text-neutral-400 transition-colors">
                                  <Plus className="w-4 h-4" />
                               </div>
                            </button>
                          )}
                       </div>
                     );
                  })}
                </div>
              );
            })}
         </div>
      </div>

      {/* 3. Internal Notes */}
      <div className="bg-card border border-border flex flex-col h-[400px]">
        {/* Header with Add Note Button */}
        <div className="p-3 border-b border-border bg-muted flex items-center justify-between shrink-0">
          <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5" />
            Notes History
          </h3>
          <div className="flex items-center gap-3">
             <span className="text-[10px] text-neutral-600 uppercase tracking-wider">{customerData.notes.length} notes</span>
             <button
               onClick={() => setIsNoteModalOpen(true)}
               className="px-3 py-1.5 bg-primary hover:brightness-110 text-black font-bold uppercase tracking-wider text-[10px] transition-colors flex items-center gap-1.5"
             >
               <Plus className="w-3 h-3" />
               Add Note
             </button>
          </div>
        </div>
        
        {/* Notes List - Full Width */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {customerData.notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500">
              <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No notes yet</p>
            </div>
          ) : (
            customerData.notes.map((note) => (
              <div key={note.id} className="flex flex-col bg-secondary border border-border">
                <div className="flex items-center justify-between bg-muted p-2 border-b border-border">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wide flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                    {note.author}
                  </span>
                  <span className="text-[12px] text-neutral-500 font-mono">{note.date}</span>
                </div>
                <div className="p-3 text-sm text-muted-foreground leading-relaxed">
                  {note.content}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const InputField = ({ label, value, onChange, placeholder, disabled, type = "text", options }: any) => (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</label>
      {options ? (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            disabled={disabled}
            className="w-full h-10 pl-3 pr-10 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors disabled:opacity-50 appearance-none cursor-pointer"
          >
            <option value="" disabled>{placeholder || `Select ${label}`}</option>
            {options.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      ) : (
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="h-10 px-3 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors disabled:opacity-50"
        />
      )}
    </div>
  );

  const FormActions = () => (
    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-border">
      <button 
        onClick={handleReset}
        className="px-6 py-2 border border-border hover:bg-muted text-muted-foreground font-bold uppercase tracking-wider text-xs transition-colors"
      >
        Reset
      </button>
      <button 
        onClick={handleUpdate}
        className="px-6 py-2 bg-primary hover:brightness-110 text-primary-foreground font-bold uppercase tracking-wider text-xs transition-colors"
      >
        Update
      </button>
    </div>
  );

  const renderGeneral = () => (
    <div className="bg-card border border-border p-6 max-w-4xl mx-auto">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-6 flex items-center gap-2">
        <User className="w-4 h-4 text-primary" />
        Personal Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <InputField 
            label="Title" 
            value={customerData.title} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, title: v} : null)} 
            options={['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof']}
          />
        </div>
        <div className="lg:col-span-1">
          <InputField 
            label="First Name" 
            value={customerData.firstName} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, firstName: v} : null)} 
          />
        </div>
        <div className="lg:col-span-1">
          <InputField 
            label="Surname" 
            value={customerData.surname} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, surname: v} : null)} 
          />
        </div>
        
        <div className="lg:col-span-1">
          <InputField 
            label="Email Address" 
            value={customerData.email} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, email: v} : null)} 
          />
        </div>
        <div className="lg:col-span-1">
          <InputField 
            label="Mobile Number" 
            value={customerData.phone} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, phone: v} : null)} 
          />
        </div>
        <div className="lg:col-span-1">
          <InputField 
            label="Membership Card No. (Optional)" 
            value={customerData.membershipCardNumber || ''} 
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, membershipCardNumber: v} : null)} 
          />
        </div>
        
        <div className="lg:col-span-1">
          <InputField 
            label="Membership Status"
            value={customerData.status}
            onChange={(v: string) => setCustomerData(prev => prev ? {...prev, status: v as any} : null)}
            options={['Active', 'Inactive', 'Banned']}
          />
        </div>

        <div className="lg:col-span-3 pt-2">
           <label className="flex items-center gap-3 cursor-pointer group">
             <div className={`w-5 h-5 border border-border flex items-center justify-center transition-colors ${customerData.guardianApproval ? 'bg-primary border-primary' : 'bg-input group-hover:border-primary/50'}`}>
               {customerData.guardianApproval && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
             </div>
             <input 
               type="checkbox" 
               className="hidden"
               checked={customerData.guardianApproval}
               onChange={(e) => setCustomerData(prev => prev ? {...prev, guardianApproval: e.target.checked} : null)}
             />
             <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Guardian Approval Obtained</span>
           </label>
        </div>
      </div>
      <FormActions />
    </div>
  );

  const renderAddress = () => (
    <div className="bg-card border border-border p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Saved Addresses
        </h3>
        <button className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
          + Add Address
        </button>
      </div>

      <div className="space-y-4">
        {customerData.addresses.map((addr) => {
          const isVisible = visibleAddressIds.has(addr.id);
          
          return (
            <div key={addr.id} className="bg-secondary border border-border p-4 flex flex-col md:flex-row gap-4 md:items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide bg-muted px-2 py-0.5 rounded">
                    {addr.label}
                  </span>
                  {addr.isVerified && (
                     <div className="flex items-center gap-1 text-emerald-500">
                       <CheckCircle className="w-3.5 h-3.5" />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Verified</span>
                     </div>
                  )}
                </div>
                
                <div className={`text-sm text-muted-foreground leading-relaxed font-mono transition-all overflow-hidden ${isVisible ? 'max-h-40' : 'max-h-6'}`}>
                   {addr.line1}<br />
                   {isVisible && (
                     <>
                       {addr.line2 && <>{addr.line2}<br /></>}
                       {addr.city}<br />
                       {addr.postcode}
                     </>
                   )}
                   {!isVisible && <span className="text-neutral-600">...</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 md:flex-col md:gap-2 shrink-0">
                <button 
                  onClick={() => toggleAddressVisibility(addr.id)}
                  className="px-3 py-1.5 border border-border hover:bg-muted text-neutral-400 hover:text-foreground text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 justify-center w-full md:w-32"
                >
                  {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {isVisible ? 'Hide' : 'View Full'}
                </button>
                <button 
                  onClick={() => verifyAddress(addr.id)}
                  className={`px-3 py-1.5 border border-border text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2 justify-center w-full md:w-32 ${
                    addr.isVerified 
                      ? 'bg-muted text-emerald-500 cursor-default' 
                      : 'hover:bg-muted text-neutral-400 hover:text-foreground'
                  }`}
                  disabled={addr.isVerified}
                >
                  {addr.isVerified ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      Verify Now
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

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
      // A - Attach to transaction
      else if (e.key.toLowerCase() === 'a' && customer) {
        e.preventDefault();
        onAttachToTransaction(customer);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customer, onAttachToTransaction, onBack]);

  if (!customer) {
    return (
      <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center gap-1 p-2 bg-card border-b border-border overflow-x-auto">
          <button 
            onClick={onBack}
            className="p-3 mr-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-border bg-card">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                 <Lock className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider">Customer Not Found</h3>
              <p className="text-xs mt-2">The customer profile you are trying to access does not exist.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Header Tabs */}
      <div className="flex items-center gap-1 p-2 bg-card border-b border-border overflow-x-auto">
        <button 
          onClick={onBack}
          className="p-3 mr-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 min-w-max transition-all relative group ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
              <span className="text-xs font-bold uppercase tracking-widest">{tab.label}</span>
              
              {isActive && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"
                />
              )}
            </button>
          );
        })}
        
        <div className="ml-auto flex items-center gap-2 px-4">
           <button 
             onClick={() => onAttachToTransaction(customer!)}
             className="px-4 py-2 bg-primary hover:brightness-110 text-primary-foreground font-bold uppercase tracking-wider text-xs transition-colors flex items-center gap-2"
           >
             <User className="w-4 h-4" />
             Attach to Transaction
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
             >
               {activeTab === 'summary' && renderSummary()}
               {activeTab === 'general' && renderGeneral()}
               {activeTab === 'address' && renderAddress()}
               {activeTab !== 'summary' && activeTab !== 'general' && activeTab !== 'address' && (
                 <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-border bg-card">
                   <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Lock className="w-6 h-6 text-muted-foreground" />
                   </div>
                   <h3 className="text-sm font-bold uppercase tracking-wider">Restricted Area</h3>
                   <p className="text-xs mt-2">Manager authorization required to view {activeTab} details.</p>
                 </div>
               )}
             </motion.div>
           </AnimatePresence>
        </div>
      </div>

      {/* Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-card border border-border w-full max-w-lg flex flex-col shadow-2xl">
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted">
                 <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                   <MessageSquare className="w-4 h-4 text-primary" />
                   Add New Note
                 </h3>
                 <button onClick={() => setIsNoteModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                   <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-4">
                 <textarea 
                   value={newNote}
                   onChange={(e) => setNewNote(e.target.value)}
                   placeholder="Type your note here..."
                   className="w-full h-32 p-3 bg-input border border-border text-foreground text-sm focus:border-primary focus:outline-none transition-colors resize-none mb-4"
                   autoFocus
                 />
                 <div className="flex justify-end gap-3">
                   <button 
                     onClick={() => setIsNoteModalOpen(false)}
                     className="px-4 py-2 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleAddNote}
                     disabled={!newNote.trim()}
                     className="px-4 py-2 bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-xs font-bold uppercase tracking-wider transition-colors"
                   >
                     Save Note
                   </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}