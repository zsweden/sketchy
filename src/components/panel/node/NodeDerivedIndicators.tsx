import { memo } from 'react';
import type { DerivedIndicator } from '../../../core/framework-types';
import FormField from '../../form/FormField';

interface Props {
  indicators: DerivedIndicator[];
}

function NodeDerivedIndicators({ indicators }: Props) {
  if (indicators.length === 0) return null;
  return (
    <FormField label="Derived Properties">
      {indicators.map((ind) => (
        <div key={ind.id} className="control-row gap-md">
          <span
            className="badge"
            style={{ backgroundColor: `${ind.color}15`, color: ind.color }}
          >
            {ind.shortName}
          </span>
          <span className="field-label">{ind.description}</span>
        </div>
      ))}
    </FormField>
  );
}

export default memo(NodeDerivedIndicators);
