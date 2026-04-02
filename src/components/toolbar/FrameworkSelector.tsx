import { useDiagramStore } from '../../store/diagram-store';
import { listFrameworks } from '../../frameworks/registry';

export default function FrameworkSelector() {
  const currentId = useDiagramStore((s) => s.framework.id);
  const setFramework = useDiagramStore((s) => s.setFramework);
  const hasDiagramWork = useDiagramStore((s) =>
    s.diagram.nodes.length > 1 ||
    s.diagram.edges.length > 0 ||
    s.diagram.nodes.some((n) => n.data.label !== ''),
  );

  const frameworks = listFrameworks();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    if (newId === currentId) return;
    if (
      hasDiagramWork &&
      !window.confirm(
        'Switching framework will reset the diagram. Continue?',
      )
    ) {
      e.target.value = currentId;
      return;
    }
    setFramework(newId);
  };

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
