import { Upload, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { Tooltip } from './Tooltip';
import type { Article } from '../types';
import { handleExcelImport, downloadExcel } from '../utils/excelHandler';

interface ExcelImportProps {
  articles: Article[];
}

export function ExcelImport({ articles }: ExcelImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const blob = await handleExcelImport(file, articles);
      downloadExcel(blob, file.name);
    } catch (error) {
      console.error('Error processing Excel:', error);
      alert('Chyba při zpracování Excel souboru. Zkontrolujte formát souboru.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
        id="excel-upload"
        disabled={isProcessing || articles.length === 0}
      />
      <label
        htmlFor="excel-upload"
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
          isProcessing || articles.length === 0
            ? 'bg-surface0 text-overlay0 cursor-not-allowed'
            : 'bg-surface0 text-subtext1 hover:bg-surface1 hover:text-text'
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Zpracovávám...
          </>
        ) : (
          <>
            <Upload size={18} />
            Doplnit Excel
          </>
        )}
      </label>
      <Tooltip content="Nahrajte Excel soubor s jedním sloupcem typových označení. Aplikace doplní shody a automaticky stáhne výsledek." />
    </div>
  );
}
