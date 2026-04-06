import { Search, X } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useUIStore } from '../../store/ui-store';

export default function SearchBar() {
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setSearchQuery('');
    inputRef.current?.blur();
  }, [setSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }, [close]);

  return (
    <div className="search-bar" data-testid="search-bar">
      <Search size={14} className="search-bar-icon" />
      <input
        ref={inputRef}
        type="text"
        className="search-bar-input"
        placeholder="Find nodes..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Find nodes"
      />
      {searchQuery && (
        <button
          className="btn btn-ghost btn-icon search-bar-clear"
          onClick={close}
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
