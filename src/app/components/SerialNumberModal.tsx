import { X } from 'lucide-react';
import { useState } from 'react';

interface SerialNumberModalProps {
  boxName: string;
  onSave: (serialNumber: string) => void;
  onCancel: () => void;
}

export function SerialNumberModal({ boxName, onSave, onCancel }: SerialNumberModalProps) {
  const [serialNumber, setSerialNumber] = useState('');

  const handleSave = () => {
    if (serialNumber.trim()) {
      onSave(serialNumber.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-none max-w-lg w-full p-8 border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Add Serial Number</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-none transition-colors text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Product Name */}
        <div className="mb-6">
          <div className="text-base text-muted-foreground mb-1 uppercase tracking-wider font-bold">Product</div>
          <div className="text-lg text-foreground font-medium">{boxName}</div>
        </div>

        {/* Serial Number Input */}
        <div className="mb-8">
          <label className="block text-base mb-2 text-foreground font-medium">Serial Number *</label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder="Enter serial number"
            autoFocus
            className="w-full px-4 py-3 text-lg bg-background border-2 border-border rounded-none focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-4 border-2 border-border hover:bg-muted rounded-none text-lg transition-colors text-muted-foreground hover:text-foreground font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!serialNumber.trim()}
            className="flex-1 px-6 py-4 bg-primary hover:brightness-110 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed text-primary-foreground rounded-none text-lg transition-colors font-bold shadow-lg shadow-primary/20"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
