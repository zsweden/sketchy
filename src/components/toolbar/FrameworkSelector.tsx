import { useChatStore } from '../../store/chat-store';
import { useDiagramStore } from '../../store/diagram-store';
import { listFrameworks } from '../../frameworks/registry';

export default function FrameworkSelector() {
  const currentId = useDiagramStore((s) => s.diagram.frameworkId);
  const setFramework = useDiagramStore((s) => s.setFramework);
  const autoMode = useChatStore((s) => s.autoMode);
  const hasDiagramWork = useDiagramStore((s) =>
    s.diagram.nodes.length > 1 ||
    s.diagram.edges.length > 0 ||
    s.diagram.nodes.some((n) => n.data.label !== ''),
  );

  const frameworks = listFrameworks();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;

    if (newId === 'auto') {
      if (autoMode) return;
      useChatStore.getState().setAutoMode(true);
      useChatStore.getState().clearMessages();
      useChatStore.getState().clearAiModified();
      return;
    }

    if (autoMode) {
      useChatStore.getState().setAutoMode(false);
    }

    if (newId === currentId && !autoMode) return;
    if (
      hasDiagramWork &&
      !window.confirm(
        'Switching framework will reset the diagram. Continue?',
      )
    ) {
      e.target.value = autoMode ? 'auto' : currentId;
      return;
    }
    setFramework(newId);
    useChatStore.getState().clearMessages();
    useChatStore.getState().clearAiModified();
  };

  return (
    <select
      className="select-control"
      value={autoMode ? 'auto' : currentId}
      onChange={handleChange}
      aria-label="Framework"
    >
      <option value="auto">Auto</option>
      {frameworks.map((fw) => (
        <option key={fw.id} value={fw.id}>
          {fw.name}
        </option>
      ))}
    </select>
  );
}
