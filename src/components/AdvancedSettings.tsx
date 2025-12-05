import { Settings, Upload, Trash2, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { Tooltip } from './Tooltip';
import type { Article } from '../types';
import { parseCSV } from '../utils/csvParser';

interface AdvancedSettingsProps {
  onCustomDataLoad: (data: Article[]) => void;
  onClearCustomData: () => void;
  hasCustomData: boolean;
}

export function AdvancedSettings({
  onCustomDataLoad,
  onClearCustomData,
  hasCustomData,
}: AdvancedSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseCSV(text);

      if (data.length === 0) {
        alert('CSV soubor je prázdný nebo má neplatný formát.');
        return;
      }

      onCustomDataLoad(data);
      alert(`Načteno ${data.length} záznamů z vlastního CSV souboru.`);
      setIsOpen(false);
    } catch (error) {
      console.error('Error loading custom CSV:', error);
      alert('Chyba při načítání CSV souboru.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = () => {
    if (confirm('Opravdu chcete vymazat vlastní databázi a vrátit se k výchozí?')) {
      onClearCustomData();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
          isOpen || hasCustomData
            ? 'bg-mauve text-crust shadow-lg'
            : 'bg-surface0 text-subtext1 hover:bg-surface1'
        }`}
      >
        <Settings size={18} />
        Pokročilé možnosti
        <Tooltip content="Nahrajte vlastní CSV databázi nebo vymažte načtenou databázi" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="absolute top-full mt-2 right-0 w-96 bg-surface0 rounded-2xl shadow-2xl z-50 animate-fade-in border border-surface2">
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-text">Pokročilé možnosti</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-overlay1 hover:text-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Custom data info */}
              {hasCustomData && (
                <div className="bg-mauve/10 border border-mauve/30 rounded-xl p-3">
                  <p className="text-sm text-mauve font-medium">
                    Používáte vlastní databázi
                  </p>
                </div>
              )}

              {/* Upload custom CSV */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-subtext1">
                  Nahrát vlastní CSV soubor
                </label>
                <p className="text-xs text-overlay1">
                  Formát: Typové označení;Artikl;Výrobce;Název;Číslo dílu výrobce
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="custom-csv-upload"
                />
                <label
                  htmlFor="custom-csv-upload"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-surface1 text-text
                    rounded-xl font-medium transition-all cursor-pointer hover:bg-surface2"
                >
                  <Upload size={18} />
                  Vybrat CSV soubor
                </label>
              </div>

              {/* Clear custom data */}
              {hasCustomData && (
                <button
                  onClick={handleClear}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red/20 text-red
                    rounded-xl font-medium transition-all hover:bg-red/30"
                >
                  <Trash2 size={18} />
                  Vymazat vlastní databázi
                </button>
              )}

              {/* Info */}
              <div className="bg-surface1 rounded-xl p-3 text-xs text-overlay1 space-y-1">
                <p>
                  • Vlastní CSV soubor nahradí aktuální databázi
                </p>
                <p>
                  • Pro návrat k výchozím databázím klikněte na "Vymazat"
                </p>
                <p>
                  • CSV soubor musí používat středník (;) jako oddělovač
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
