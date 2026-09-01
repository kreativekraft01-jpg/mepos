import { Search, X } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Focus search on '/' key
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search products (Press / to focus)..."
        className="w-full pl-14 pr-14 py-4 text-lg bg-card text-foreground border-2 border-input rounded-lg focus:outline-none focus:border-ring placeholder:text-muted-foreground"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
          title="Clear search"
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
