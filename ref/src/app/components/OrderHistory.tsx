import { X, ChevronDown, ChevronUp, Printer, FileText, Gift, Send, RotateCcw, ShoppingCart, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

interface OrderHistoryProps {
  orders: any[];
  onClose: () => void;
}

type OrderType = 'sell' | 'buy' | 'exchange' | 'mixed';
type TabType = 'processed' | 'unprocessed';

interface Transaction {
  orderNumber: string;
  dateTime: string;
  staff: string;
  float: string;
  orderType: OrderType;
  qty: number;
  total: number;
  customer?: string;
  items?: Array<{ name: string; qty: number; price: number }>;
}

const MOCK_PROCESSED: Transaction[] = [
  {
    orderNumber: 'ORD-2024-0156',
    dateTime: '2024-01-22 14:32',
    staff: 'John Smith',
    float: 'Float 2',
    orderType: 'sell',
    qty: 3,
    total: 1251.00,
    customer: 'Michael Johnson',
    items: [
      { name: 'iPhone 14 Pro', qty: 1, price: 799.00 },
      { name: 'PlayStation 5', qty: 1, price: 449.00 },
      { name: 'Call of Duty', qty: 1, price: 3.00 },
    ]
  },
  {
    orderNumber: 'ORD-2024-0155',
    dateTime: '2024-01-22 13:15',
    staff: 'Sarah Johnson',
    float: 'Float 5',
    orderType: 'buy',
    qty: 2,
    total: 450.00,
    customer: 'Emma Wilson',
    items: [
      { name: 'Xbox Series X', qty: 1, price: 350.00 },
      { name: 'iPad Air', qty: 1, price: 100.00 },
    ]
  },
  {
    orderNumber: 'ORD-2024-0154',
    dateTime: '2024-01-22 12:45',
    staff: 'John Smith',
    float: 'Float 2',
    orderType: 'exchange',
    qty: 4,
    total: 125.50,
    customer: 'Robert Brown',
    items: [
      { name: 'Nintendo Switch Game', qty: 2, price: 40.00 },
      { name: 'MacBook Pro Charger', qty: 1, price: 35.50 },
      { name: 'USB-C Cable', qty: 1, price: 10.00 },
    ]
  },
  {
    orderNumber: 'ORD-2024-0153',
    dateTime: '2024-01-22 11:20',
    staff: 'Sarah Johnson',
    float: 'Float 5',
    orderType: 'mixed',
    qty: 5,
    total: 899.99,
    customer: 'David Lee',
    items: [
      { name: 'Samsung Galaxy S23', qty: 1, price: 650.00 },
      { name: 'Nintendo Switch OLED', qty: 1, price: 299.99 },
      { name: 'AirPods Pro', qty: 2, price: -50.00 },
    ]
  },
  {
    orderNumber: 'ORD-2024-0152',
    dateTime: '2024-01-22 10:05',
    staff: 'John Smith',
    float: 'Float 2',
    orderType: 'sell',
    qty: 1,
    total: 35.00,
    customer: 'Walk-in Customer',
    items: [
      { name: 'FIFA 24', qty: 1, price: 35.00 },
    ]
  },
];

const MOCK_UNPROCESSED: Transaction[] = [
  {
    orderNumber: 'ORD-2024-0157',
    dateTime: '2024-01-22 15:10',
    staff: 'John Smith',
    float: 'Float 2',
    orderType: 'sell',
    qty: 2,
    total: 650.00,
  },
  {
    orderNumber: 'ORD-2024-0158',
    dateTime: '2024-01-22 15:22',
    staff: 'Sarah Johnson',
    float: 'Float 5',
    orderType: 'buy',
    qty: 1,
    total: 299.00,
  },
];

export function OrderHistory({ orders, onClose }: OrderHistoryProps) {
  const [activeTab, setActiveTab] = useState<TabType>('processed');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState('today');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedFloat, setSelectedFloat] = useState('all');

  const handleDeleteOrder = (orderNumber: string) => {
    toast.error(`Order ${orderNumber} deleted`, {
      description: 'The transaction record has been removed.',
    });
  };

  const toggleRow = (orderNumber: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderNumber)) {
      newExpanded.delete(orderNumber);
    } else {
      newExpanded.add(orderNumber);
    }
    setExpandedRows(newExpanded);
  };

  const getOrderTypeColor = (type: OrderType) => {
    switch (type) {
      case 'sell': return 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20';
      case 'buy': return 'bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20';
      case 'exchange': return 'bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20';
      case 'mixed': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
    }
  };

  const getOrderTextColor = (type: OrderType) => {
    switch (type) {
      case 'sell': return 'text-[#10B981]';
      case 'buy': return 'text-[#8B5CF6]';
      case 'exchange': return 'text-[#3B82F6]';
      case 'mixed': return 'text-orange-500';
      default: return 'text-foreground';
    }
  };

  const currentData = activeTab === 'processed' ? MOCK_PROCESSED : MOCK_UNPROCESSED;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-card rounded-[4px] w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl border border-border">
        {/* Header with Title, Tabs and Filters */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-6 mb-4">
            {/* Title */}
            <h2 className="text-2xl font-bold whitespace-nowrap text-[rgb(202,207,214)]">Recent Transactions</h2>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-sm transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs and Filters Row */}
          <div className="flex items-center gap-4">
            {/* Tabs - Switch Style */}
            <div className="relative bg-muted rounded-[4px] p-1 flex">
              <button
                onClick={() => setActiveTab('processed')}
                className={`px-6 py-2 text-sm font-medium rounded-sm transition-all relative z-10 ${
                  activeTab === 'processed'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Processed ({MOCK_PROCESSED.length})
              </button>
              <button
                onClick={() => setActiveTab('unprocessed')}
                className={`px-6 py-2 text-sm font-medium rounded-sm transition-all relative z-10 ${
                  activeTab === 'unprocessed'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Unprocessed ({MOCK_UNPROCESSED.length})
              </button>
              {/* Sliding background */}
              <div
                className={`absolute top-1 bottom-1 rounded-sm transition-all duration-300 ${
                  activeTab === 'processed' ? 'bg-primary' : 'bg-primary'
                }`}
                style={{
                  left: activeTab === 'processed' ? '4px' : '50%',
                  right: activeTab === 'processed' ? '50%' : '4px',
                }}
              />
            </div>

            {/* Date Range */}
            <div className="flex-1 relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-[12px] py-[8px] pr-10 border-2 border-border rounded-sm text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary appearance-none"
              >
                <option value="" disabled>Date Range</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Staff Member */}
            <div className="flex-1 relative">
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-4 py-2 pr-10 border-2 border-border rounded-sm text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary appearance-none"
              >
                <option value="" disabled>Staff Member</option>
                <option value="all">All Staff</option>
                <option value="john">John Smith</option>
                <option value="sarah">Sarah Johnson</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* Float Number */}
            <div className="flex-1 relative">
              <select
                value={selectedFloat}
                onChange={(e) => setSelectedFloat(e.target.value)}
                className="w-full px-4 py-2 pr-10 border-2 border-border rounded-sm text-sm bg-card text-foreground cursor-pointer hover:border-primary focus:outline-none focus:border-primary appearance-none"
              >
                <option value="" disabled>Float Number</option>
                <option value="all">All Floats</option>
                <option value="float1">Float 1</option>
                <option value="float2">Float 2</option>
                <option value="float3">Float 3</option>
                <option value="float4">Float 4</option>
                <option value="float5">Float 5</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card rounded-[4px] border-2 border-border overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="p-4 text-left text-sm font-medium w-12 text-muted-foreground"></th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Order #</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Date & Time</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Staff</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Float</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Qty</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Total</th>
                  <th className="p-4 text-left text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentData.flatMap((transaction) => {
                  const rows = [
                    <tr 
                      key={`main-${transaction.orderNumber}`} 
                      className="border-b border-border group hover:bg-muted/50 transition-colors"
                    >
                      {/* Expand/Collapse */}
                      <td className="p-4">
                        <button
                          onClick={() => toggleRow(transaction.orderNumber)}
                          className="p-1 hover:bg-muted rounded-sm transition-colors text-muted-foreground group-hover:text-foreground"
                        >
                          {expandedRows.has(transaction.orderNumber) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </td>

                      {/* Order Number */}
                      <td className="p-4">
                        <span className="font-medium text-base text-[rgb(202,207,214)]">{transaction.orderNumber}</span>
                      </td>

                      {/* Date & Time */}
                      <td className="p-4 text-base text-muted-foreground">{transaction.dateTime}</td>

                      {/* Staff */}
                      <td className="p-4 text-base text-muted-foreground">{transaction.staff}</td>

                      {/* Float */}
                      <td className="p-4 text-base text-muted-foreground">{transaction.float}</td>

                      {/* Order Type */}
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-sm text-sm font-medium capitalize ${getOrderTypeColor(transaction.orderType)}`}>
                          {transaction.orderType}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="p-4 text-base text-muted-foreground">{transaction.qty}</td>

                      {/* Total */}
                      <td className={`p-4 text-base font-bold ${getOrderTextColor(transaction.orderType)}`}>£{transaction.total.toFixed(2)}</td>

                      {/* Actions */}
                      <td className="p-4">
                        {activeTab === 'processed' ? (
                          <div className="flex gap-2">
                            {/* Print Options */}
                            <div className="flex gap-1 mr-2 border-r border-border pr-2">
                              <button
                                className="p-3 hover:bg-primary/10 rounded-sm transition-colors group/btn"
                                title="Print Label"
                              >
                                <Printer className="w-6 h-6 text-primary" />
                              </button>
                              <button
                                className="p-3 hover:bg-primary/10 rounded-sm transition-colors group/btn"
                                title="Reprint Receipt"
                              >
                                <FileText className="w-6 h-6 text-primary" />
                              </button>
                            </div>
                            {/* Hamburger Menu for Additional Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="p-3 hover:bg-muted rounded-sm transition-colors"
                                  title="More Actions"
                                >
                                  <MoreVertical className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 bg-card border-border text-foreground">
                                <DropdownMenuItem className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => toast.info('Reprinting Gift Receipt')}>
                                  <Gift className="w-5 h-5 text-purple-500" />
                                  <span className="text-base">Reprint Gift Receipt</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => toast.info('Resubmitting FPS Request')}>
                                  <Send className="w-5 h-5 text-orange-500" />
                                  <span className="text-base">Resubmit FPS Request</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted focus:bg-muted" onClick={() => toast.warning('Initiating Refund')}>
                                  <RotateCcw className="w-5 h-5 text-destructive" />
                                  <span className="text-base">Refund</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <button className="px-4 py-2 bg-primary hover:bg-primary text-black rounded-sm flex items-center gap-2 transition-colors">
                            <ShoppingCart className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ];

                  // Add expanded details row if expanded
                  if (expandedRows.has(transaction.orderNumber)) {
                    rows.push(
                      <tr key={`detail-${transaction.orderNumber}`} className="bg-muted/20 border-b border-border">
                        <td colSpan={9} className="p-6">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Customer Info */}
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Customer</h4>
                              <p className="text-base text-foreground">{transaction.customer || 'Walk-in Customer'}</p>
                            </div>

                            {/* Items List */}
                            {transaction.items && (
                              <div>
                                <h4 className="text-sm font-medium text-muted-foreground mb-2">Items</h4>
                                <div className="space-y-1">
                                  {transaction.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-base text-foreground">
                                      <span>{item.name} × {item.qty}</span>
                                      <span className={`font-medium ${getOrderTextColor(transaction.orderType)}`}>£{item.price.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


