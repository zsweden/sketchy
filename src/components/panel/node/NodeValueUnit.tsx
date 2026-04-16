import { memo, useCallback, useEffect, useState } from 'react';
import { useDiagramStore } from '../../../store/diagram-store';
import FormField from '../../form/FormField';

interface Props {
  nodeId: string;
  value: number | undefined;
  unit: string;
}

function handleEnterBlur(e: React.KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    (e.target as HTMLInputElement).blur();
  }
}

function NodeValueUnit({ nodeId, value, unit }: Props) {
  const commitNodeValue = useDiagramStore((s) => s.commitNodeValue);
  const commitNodeUnit = useDiagramStore((s) => s.commitNodeUnit);
  const [valueStr, setValueStr] = useState(value != null ? String(value) : '');
  const [unitDraft, setUnitDraft] = useState(unit);

  useEffect(() => {
    setValueStr(value != null ? String(value) : '');
  }, [value]);

  useEffect(() => {
    setUnitDraft(unit);
  }, [unit]);

  const handleValueBlur = useCallback(() => {
    const trimmed = valueStr.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    if (parsed === value) return;
    if (trimmed !== '' && isNaN(parsed!)) {
      // Reset to stored value on invalid input
      setValueStr(value != null ? String(value) : '');
      return;
    }
    commitNodeValue(nodeId, parsed);
  }, [valueStr, value, nodeId, commitNodeValue]);

  const handleUnitBlur = useCallback(() => {
    if (unitDraft !== unit) commitNodeUnit(nodeId, unitDraft);
  }, [unitDraft, unit, nodeId, commitNodeUnit]);

  return (
    <FormField label="Value">
      <div className="control-row" style={{ gap: '0.5rem' }}>
        <input
          type="text"
          inputMode="decimal"
          className="input-text"
          value={valueStr}
          onChange={(e) => setValueStr(e.target.value)}
          onBlur={handleValueBlur}
          onKeyDown={handleEnterBlur}
          placeholder="e.g. 3000000"
          aria-label="Node value"
          style={{ flex: 2 }}
        />
        <input
          type="text"
          className="input-text"
          value={unitDraft}
          onChange={(e) => setUnitDraft(e.target.value)}
          onBlur={handleUnitBlur}
          onKeyDown={handleEnterBlur}
          placeholder="e.g. $"
          aria-label="Node unit"
          style={{ flex: 1 }}
        />
      </div>
    </FormField>
  );
}

export default memo(NodeValueUnit);
