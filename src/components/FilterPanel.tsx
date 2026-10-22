import { Filter } from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from './Tooltip';

interface FilterPanelProps {
  manufacturers: string[];
  selectedManufacturers: string[];
  onSelectionChange: (selected: string[]) => void;
}

export function FilterPanel({
  manufacturers,
  selectedManufacturers,
  onSelectionChange,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredManufacturers = manufacturers.filter((m) =>
    m.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleManufacturer = (manufacturer: string) => {
    if (selectedManufacturers.includes(manufacturer)) {
      onSelectionChange(selectedManufacturers.filter((m) => m !== manufacturer));
    } else {
      onSelectionChange([...selectedManufacturers, manufacturer]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
  };

  const selectAll = () => {
    onSelectionChange(manufacturers);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn h-8 ${
          isOpen || selectedManufacturers.length > 0
            ? 'bg-mauve/10 border-mauve/40 text-mauve'
            : 'btn-secondary'
        }`}
      >
        <Filter size={15} />
        Filtrovat výrobce
        {selectedManufacturers.length > 0 && (
          <span className="px-1.5 py-px bg-mauve text-on-accent rounded text-[11px] font-semibold">
            {selectedManufacturers.length}
          </span>
        )}
        <Tooltip content="Filtrujte výsledky podle vybraných výrobců" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 w-80 bg-mantle rounded-lg shadow-xl z-50 animate-fade-in border border-surface1">
            <div className="p-4 space-y-3">
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Hledat výrobce..."
                className="input"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="flex-1 px-3 py-1.5 text-sm bg-surface0 border border-surface1 text-subtext1 rounded-md
                    hover:bg-surface1 transition-colors"
                >
                  Vybrat vše
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-3 py-1.5 text-sm bg-surface0 border border-surface1 text-subtext1 rounded-md
                    hover:bg-surface1 transition-colors"
                >
                  Zrušit výběr
                </button>
              </div>

              {/* List */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                {filteredManufacturers.length === 0 ? (
                  <div className="text-center py-4 text-overlay1 text-sm">
                    Žádný výrobce nenalezen
                  </div>
                ) : (
                  filteredManufacturers.map((manufacturer) => (
                    <label
                      key={manufacturer}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface1
                        transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedManufacturers.includes(manufacturer)}
                        onChange={() => toggleManufacturer(manufacturer)}
                        className="w-4 h-4 rounded accent-mauve cursor-pointer"
                      />
                      <span className="text-text text-sm">{manufacturer}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
