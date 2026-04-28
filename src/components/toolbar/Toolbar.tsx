import {
  LayoutDashboard,
  Route,
  Undo2,
  Redo2,
  PanelRightClose,
  PanelRightOpen,
  MousePointer2,
  Hand,
  Settings,
  Type,
  Square,
  Circle,
  Minus,
} from 'lucide-react';
import { appVersion } from '../../core/app-version';
import FrameworkSelector from './FrameworkSelector';
import SearchBar from './SearchBar';
import SettingsPopover from './SettingsPopover';
import { AlignHorizontalIcon, AlignVerticalIcon, DistributeHorizontalIcon, DistributeVerticalIcon } from '../icons/AlignDistributeIcons';
import { useToolbarController } from './useToolbarController';

export default function Toolbar() {
  const {
    canUndo,
    canRedo,
    undo,
    redo,
    sidePanelOpen,
    interactionMode,
    setInteractionMode,
    toggleSettings,
    toggleSidePanel,
    fileInputRef,
    canAlign,
    canDistribute,
    canOptimizeEdges,
    handleAlignH,
    handleAlignV,
    handleDistributeH,
    handleDistributeV,
    pendingAnnotationTool,
    handleToggleAnnotationTool,
    handleAutoLayout,
    handleAutoEdges,
    handleNew,
    handleLoad,
    handleSave,
    handleFileChange,
  } = useToolbarController();

  return (
    <header className="app-header">
      <div className="toolbar-group">
        <img src="/mascot.svg" alt="" className="app-mascot" />
        <h1 className="app-title">Sketchy <span className="app-version">v{appVersion}</span></h1>
        <div className="toolbar-divider" />
        <FrameworkSelector />
      </div>

      <div className="toolbar-group">
        <button
          className={`btn btn-secondary btn-icon ${interactionMode === 'select' ? 'btn-toggle-active' : ''}`}
          onClick={() => setInteractionMode('select')}
          title="Select tool (V)"
          aria-label="Select tool"
        >
          <MousePointer2 size={16} />
        </button>
        <button
          className={`btn btn-secondary btn-icon ${interactionMode === 'pan' ? 'btn-toggle-active' : ''}`}
          onClick={() => setInteractionMode('pan')}
          title="Pan tool (H)"
          aria-label="Pan tool"
        >
          <Hand size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAlignH}
          disabled={!canAlign}
          title="Align horizontally"
          aria-label="Align horizontally"
        >
          <AlignHorizontalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAlignV}
          disabled={!canAlign}
          title="Align vertically"
          aria-label="Align vertically"
        >
          <AlignVerticalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleDistributeH}
          disabled={!canDistribute}
          title="Distribute horizontally"
          aria-label="Distribute horizontally"
        >
          <DistributeHorizontalIcon />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleDistributeV}
          disabled={!canDistribute}
          title="Distribute vertically"
          aria-label="Distribute vertically"
        >
          <DistributeVerticalIcon />
        </button>

        <div className="toolbar-divider" />

        <button
          className={`btn btn-secondary btn-icon ${pendingAnnotationTool === 'text' ? 'btn-toggle-active' : ''}`}
          onClick={() => handleToggleAnnotationTool('text')}
          title="Add text annotation"
          aria-label="Add text annotation"
          aria-pressed={pendingAnnotationTool === 'text'}
        >
          <Type size={16} />
        </button>
        <button
          className={`btn btn-secondary btn-icon ${pendingAnnotationTool === 'rect' ? 'btn-toggle-active' : ''}`}
          onClick={() => handleToggleAnnotationTool('rect')}
          title="Add rectangle annotation"
          aria-label="Add rectangle annotation"
          aria-pressed={pendingAnnotationTool === 'rect'}
        >
          <Square size={16} />
        </button>
        <button
          className={`btn btn-secondary btn-icon ${pendingAnnotationTool === 'ellipse' ? 'btn-toggle-active' : ''}`}
          onClick={() => handleToggleAnnotationTool('ellipse')}
          title="Add ellipse annotation"
          aria-label="Add ellipse annotation"
          aria-pressed={pendingAnnotationTool === 'ellipse'}
        >
          <Circle size={16} />
        </button>
        <button
          className={`btn btn-secondary btn-icon ${pendingAnnotationTool === 'line' ? 'btn-toggle-active' : ''}`}
          onClick={() => handleToggleAnnotationTool('line')}
          title="Add line annotation"
          aria-label="Add line annotation"
          aria-pressed={pendingAnnotationTool === 'line'}
        >
          <Minus size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAutoLayout}
          title="Auto-layout"
          aria-label="Auto-layout"
        >
          <LayoutDashboard size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={handleAutoEdges}
          disabled={!canOptimizeEdges}
          title="Auto edges"
          aria-label="Auto edges"
        >
          <Route size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary btn-icon"
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn btn-secondary btn-icon"
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>

        <div className="toolbar-divider" />

        <button
          className="btn btn-secondary"
          onClick={handleNew}
          title="New diagram"
        >
          New
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleLoad}
          title="Load project"
        >
          Load
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleSave}
          title="Save project"
        >
          Save
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className="toolbar-divider" />
        <SearchBar />
      </div>

      <div className="toolbar-group toolbar-group-right">
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={toggleSettings}
            title="Settings"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
          <SettingsPopover />
        </div>

        <button
          className="btn btn-ghost btn-icon"
          onClick={toggleSidePanel}
          title="Toggle side panel"
          aria-label="Toggle side panel"
        >
          {sidePanelOpen ? (
            <PanelRightClose size={16} />
          ) : (
            <PanelRightOpen size={16} />
          )}
        </button>
      </div>
    </header>
  );
}
