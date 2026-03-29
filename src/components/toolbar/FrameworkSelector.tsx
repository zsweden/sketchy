import { useCallback } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { listFrameworks } from '../../frameworks/registry';

export default function FrameworkSelector() {
  const currentId = useDiagramStore((s) => s.framework.id);
  const setFramework = useDiagramStore((s) => s.setFramework);
  const nodeCount = useDiagramStore((s) => s.diagram.nodes.length);

  const frameworks = listFrameworks();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newId = e.target.value;
      if (newId === currentId) return;
      if (
        nodeCount > 0 &&
        !window.confirm(
          'Switching framework will reset the diagram. Continue?',
        )
      ) {
        e.target.value = currentId;
        return;
      }
      setFramework(newId);
    },
    [currentId, nodeCount, setFramework],
  );

  return (
    <select
      className="select-control"
      value={currentId}
      onChange={handleChange}
      aria-label="Framework"
    >
      {frameworks.map((fw) => (
        <option key={fw.id} value={fw.id}>
          {fw.name}
        </option>
      ))}
    </select>
  );
}
