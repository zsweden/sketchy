import { Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { useUIStore } from '../../store/ui-store';
import { getSkillsForFramework } from '../../skills/registry';
import { getFramework } from '../../frameworks/registry';
import type { Skill } from '../../core/skill-types';
import type { Diagram } from '../../core/types';

/** Serialize a diagram's nodes and edges into a readable snapshot for the AI. */
function serializeDiagramSnapshot(diagram: Diagram): string {
  const nodes = diagram.nodes
    .map((n) => {
      const parts = [`id="${n.id}", label="${n.data.label}"`];
      if (n.data.tags.length) parts.push(`tags=[${n.data.tags.join(', ')}]`);
      if (n.data.notes) parts.push(`notes="${n.data.notes}"`);
      if (n.data.value != null) parts.push(`value=${n.data.value}`);
      if (n.data.unit) parts.push(`unit="${n.data.unit}"`);
      return `  - ${parts.join(', ')}`;
    })
    .join('\n');

  const edges = diagram.edges
    .map((e) => {
      const parts = [`"${e.source}" → "${e.target}"`];
      if (e.notes) parts.push(`notes="${e.notes}"`);
      return `  - ${parts.join(', ')}`;
    })
    .join('\n');

  return `SOURCE DIAGRAM ("${diagram.name}", framework: ${diagram.frameworkId})\n\nNodes:\n${nodes || '  (none)'}\n\nEdges:\n${edges || '  (none)'}`;
}

export default function SkillMenu() {
  const frameworkId = useDiagramStore((s) => s.diagram.frameworkId);
  const setFramework = useDiagramStore((s) => s.setFramework);
  const skills = getSkillsForFramework(frameworkId);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback((skill: Skill) => {
    setOpen(false);

    // Capture the current diagram BEFORE switching frameworks so the AI sees it
    let instructions = skill.instructions;
    const switchesFramework = skill.endingFramework && skill.endingFramework !== frameworkId;
    if (switchesFramework) {
      if (!window.confirm('This skill will switch to a different framework. The current diagram will be reset. Continue?')) {
        return;
      }
      const snapshot = serializeDiagramSnapshot(useDiagramStore.getState().diagram);
      instructions = `${snapshot}\n\n---\n\n${skill.instructions}`;
      setFramework(skill.endingFramework!);
    }

    // Open chat panel if minimized
    const chatMode = useUIStore.getState().chatPanelMode;
    if (chatMode === 'min') {
      useUIStore.getState().setChatPanelMode('shared');
    }

    useChatStore.getState().sendMessage(instructions, undefined, `Skill: ${skill.name}`);
  }, [frameworkId, setFramework]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const hasSkills = skills.length > 0;

  return (
    <div className="skill-menu" ref={menuRef}>
      <button
        className="btn btn-secondary btn-icon"
        onClick={() => hasSkills && setOpen((o) => !o)}
        disabled={!hasSkills}
        title={hasSkills ? 'Skills' : 'No skills for this framework'}
        aria-label="Skills"
        aria-expanded={open}
      >
        <Zap size={16} />
      </button>
      {open && (
        <div className="skill-menu-dropdown">
          {skills.map((skill) => {
            const targetAbbr = skill.endingFramework && skill.endingFramework !== frameworkId
              ? getFramework(skill.endingFramework)?.abbreviation ?? skill.endingFramework
              : null;
            return (
              <button
                key={skill.id}
                className="skill-menu-item"
                onClick={() => handleRun(skill)}
              >
                {skill.name}{targetAbbr && ` (\u2192 ${targetAbbr})`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
