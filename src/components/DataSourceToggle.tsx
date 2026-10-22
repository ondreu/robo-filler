import { Database } from 'lucide-react';
import type { DataSource } from '../types';
import { Tooltip } from './Tooltip';
import { Segmented } from './ui/Segmented';

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
    <div className="flex items-center gap-2.5">
      <Database size={16} className="text-overlay1" />
      <span className="field-label">Databáze</span>
      <Tooltip content="Přepínejte mezi databázemi Ústí, Effretikon nebo oběma najednou" />
      <Segmented
        ariaLabel="Databáze"
        value={dataSource}
        onChange={onDataSourceChange}
        disabled={isLoading}
        options={[
          { value: 'usti', label: 'Ústí' },
          { value: 'effi', label: 'Effretikon' },
          { value: 'both', label: 'Obě' },
        ]}
      />
    </div>
  );
}
