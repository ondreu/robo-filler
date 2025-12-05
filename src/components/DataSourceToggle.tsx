import type { DataSource } from '../types';
import { Tooltip } from './Tooltip';

interface DataSourceToggleProps {
  dataSource: DataSource;
  onDataSourceChange: (source: DataSource) => void;
  isLoading: boolean;
}

export function DataSourceToggle({
  dataSource,
  onDataSourceChange,
  isLoading,
}: DataSourceToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-subtext1 text-sm font-medium">Databáze:</span>
      <Tooltip content="Přepínejte mezi databázemi Ústí a Effretikon" />
      <div className="flex bg-surface0 rounded-2xl p-1 shadow-inner">
        <button
          onClick={() => onDataSourceChange('usti')}
          disabled={isLoading}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            dataSource === 'usti'
              ? 'bg-green text-crust shadow-lg'
              : 'text-subtext1 hover:text-text'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Ústí
        </button>
        <button
          onClick={() => onDataSourceChange('effi')}
          disabled={isLoading}
          className={`px-6 py-2 rounded-xl font-medium transition-all ${
            dataSource === 'effi'
              ? 'bg-red text-crust shadow-lg'
              : 'text-subtext1 hover:text-text'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          Effretikon
        </button>
      </div>
    </div>
  );
}
