import { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import type { DiagramNode, JunctionType } from '../../core/types';
import { getJunctionOptions } from '../../core/framework-types';
import { useDiagramStore, useFramework } from '../../store/diagram-store';
import { useChatStore } from '../../store/chat-store';
import FormField from '../form/FormField';
import ButtonGroup from '../form/ButtonGroup';
import LoopCard from '../form/LoopCard';
import {
  findCausalLoops,
  labelCausalLoops,
  computeNodeDegrees,
  getDerivedIndicators,
} from '../../core/graph/derived';
import { useUIStore } from '../../store/ui-store';

interface Props {
  node: DiagramNode;
}

export default function NodePanel({ node }: Props) {
  const [text, setText] = useState(node.data.label);
  const [notes, setNotes] = useState(node.data.notes ?? '');

  const framework = useFramework();
  const nodes = useDiagramStore((s) => s.diagram.nodes);
  const edges = useDiagramStore((s) => s.diagram.edges);
  const commitNodeText = useDiagramStore((s) => s.commitNodeText);
  const updateNodeTags = useDiagramStore((s) => s.updateNodeTags);
  const updateNodeJunction = useDiagramStore((s) => s.updateNodeJunction);
  const commitNodeNotes = useDiagramStore((s) => s.commitNodeNotes);
  const toggleNodeLocked = useDiagramStore((s) => s.toggleNodeLocked);
  const removeAiModified = useChatStore((s) => s.removeAiModified);
  const selectedLoopId = useUIStore((s) => s.selectedLoopId);
  const setSelectedLoop = useUIStore((s) => s.setSelectedLoop);

  // Clear the AI-modified green dot when the user views this node
  useEffect(() => {
    removeAiModified(node.id);
  }, [node.id, removeAiModified]);

  const degreesMap = computeNodeDegrees(edges);
  const degrees = degreesMap.get(node.id) ?? { indegree: 0, outdegree: 0 };
  const derived = getDerivedIndicators(node.id, degreesMap, framework.derivedIndicators);
  const loops = framework.allowsCycles ? labelCausalLoops(findCausalLoops(edges)) : [];
  const nodeLoops = loops.filter((loop) => loop.nodeIds.includes(node.id));
  const nodeLabels = new Map(nodes.map((entry) => [entry.id, entry.data.label || entry.id]));

  useEffect(() => {
    // Keep the text draft aligned when the selected node changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(node.data.label);
  }, [node.data.label]);

  useEffect(() => {
    // Keep the notes draft aligned when the selected node changes externally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(node.data.notes ?? '');
  }, [node.data.notes]);

  const handleNotesBlur = useCallback(() => {
    const current = node.data.notes ?? '';
    if (notes !== current) {
      commitNodeNotes(node.id, notes);
    }
  }, [notes, node.data.notes, node.id, commitNodeNotes]);

  const handleTextBlur = useCallback(() => {
    if (text !== node.data.label) {
      commitNodeText(node.id, text);
    }
  }, [text, node.data.label, node.id, commitNodeText]);

  const handleTextKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        (e.target as HTMLTextAreaElement).blur();
      }
    },
    [],
  );

  const toggleTag = useCallback(
    (tagId: string) => {
      const current = node.data.tags;
      const next = current.includes(tagId)
        ? current.filter((t) => t !== tagId)
        : [...current, tagId];
      updateNodeTags(node.id, next);
    },
    [node.id, node.data.tags, updateNodeTags],
  );

  return (
    <div className="section-stack">
      <div className="control-row split-row">
        <p className="section-heading">Node</p>
        <button
          className="btn btn-secondary btn-xs"
          title={node.data.locked ? 'Unlock position' : 'Lock position'}
          onClick={() => toggleNodeLocked([node.id], !node.data.locked)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          {node.data.locked ? <Lock size={12} /> : <Unlock size={12} />}
          {node.data.locked ? 'Locked' : 'Unlocked'}
        </button>
      </div>
      <FormField label="Name">
        <textarea
          className="input-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          rows={3}
          placeholder="Enter text..."
          aria-label="Node text"
        />
      </FormField>

      <FormField label="Notes">
        <textarea
          className="input-text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={4}
          placeholder="Add notes..."
          style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
          aria-label="Node notes"
        />
      </FormField>

      {/* Tags */}
      {framework.nodeTags.length > 0 && (
        <FormField label="Tags">
          <div className="control-row">
            {framework.nodeTags.map((tag) => (
              <button
                key={tag.id}
                className="tag-chip"
                data-active={node.data.tags.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
                style={
                  node.data.tags.includes(tag.id)
                    ? { color: tag.color, borderColor: tag.color }
                    : undefined
                }
                title={tag.description}
              >
                <span
                  className="tag-chip-dot"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        </FormField>
      )}

      {/* Junction / Operator */}
      {(() => {
        const options = getJunctionOptions(framework);
        const isMath = options.some((o) => o.id === 'add' || o.id === 'multiply');
        if (!framework.supportsJunctions || (isMath ? degrees.indegree < 1 : degrees.indegree < 2)) return null;
        const current = options.find((o) => o.id === node.data.junctionType);
        return (
          <FormField label={isMath ? 'Operator' : 'Junction Logic'}>
            <ButtonGroup
              items={options.map((o) => ({ value: o.id as JunctionType, label: o.label }))}
              selected={node.data.junctionType}
              onSelect={(v) => updateNodeJunction(node.id, v)}
            />
            {current && (
              <p className="field-label" style={{ marginTop: '-0.25rem' }}>
                {current.description}
              </p>
            )}
          </FormField>
        );
      })()}

      {/* Derived indicators */}
      {derived.length > 0 && (
        <FormField label="Derived Properties">
          {derived.map((ind) => (
            <div key={ind.id} className="control-row gap-md">
              <span
                className="badge"
                style={{
                  backgroundColor: `${ind.color}15`,
                  color: ind.color,
                }}
              >
                {ind.shortName}
              </span>
              <span className="field-label">{ind.description}</span>
            </div>
          ))}
        </FormField>
      )}

      {framework.allowsCycles && (
        <FormField label="Loop Membership">
          {nodeLoops.length === 0 ? (
            <p className="field-label">This variable is not part of a detected feedback loop.</p>
          ) : (
            nodeLoops.map((loop) => (
              <LoopCard
                key={loop.id}
                loop={loop}
                selected={selectedLoopId === loop.id}
                onSelect={() => setSelectedLoop(selectedLoopId === loop.id ? null : loop.id)}
                nodeLabels={nodeLabels}
              />
            ))
          )}
        </FormField>
      )}
    </div>
  );
}
