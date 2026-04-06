import { Zap } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import { useUIStore } from '../../store/ui-store';
import { getSkillsForFramework } from '../../skills/registry';
import type { Skill } from '../../core/skill-types';

export default function SkillMenu() {
  const frameworkId = useDiagramStore((s) => s.diagram.frameworkId);
  const setFramework = useDiagramStore((s) => s.setFramework);
  const skills = getSkillsForFramework(frameworkId);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback((skill: Skill) => {
    setOpen(false);

    if (skill.endingFramework && skill.endingFramework !== frameworkId) {
      setFramework(skill.endingFramework);
    }

    // Open chat panel if minimized
    const chatMode = useUIStore.getState().chatPanelMode;
    if (chatMode === 'min') {
      useUIStore.getState().setChatPanelMode('shared');
    }

    useChatStore.getState().sendMessage(skill.instructions, undefined, skill.name);
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
          {skills.map((skill) => (
            <button
              key={skill.id}
              className="skill-menu-item"
              onClick={() => handleRun(skill)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
