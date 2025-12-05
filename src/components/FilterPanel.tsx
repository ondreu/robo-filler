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
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
          isOpen || selectedManufacturers.length > 0
            ? 'bg-mauve text-crust shadow-lg'
            : 'bg-surface0 text-subtext1 hover:bg-surface1'
        }`}
      >
        <Filter size={18} />
        Filtrovat výrobce
        {selectedManufacturers.length > 0 && (
          <span className="px-2 py-0.5 bg-crust/30 rounded-full text-xs">
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
          <div className="absolute top-full mt-2 left-0 w-80 bg-surface0 rounded-2xl shadow-2xl z-50 animate-fade-in border border-surface2">
            <div className="p-4 space-y-3">
              {/* Search */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Hledat výrobce..."
                className="w-full px-3 py-2 bg-surface1 text-text rounded-xl border border-surface2
                  focus:border-mauve focus:outline-none transition-colors placeholder:text-overlay1"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="flex-1 px-3 py-1.5 text-sm bg-surface1 text-subtext1 rounded-lg
                    hover:bg-surface2 transition-colors"
                >
                  Vybrat vše
                </button>
                <button
                  onClick={clearAll}
                  className="flex-1 px-3 py-1.5 text-sm bg-surface1 text-subtext1 rounded-lg
                    hover:bg-surface2 transition-colors"
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
