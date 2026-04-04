import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveSkyFile } from '../sky-io';
import { createEmptyDiagram } from '../../types';
import type { Diagram } from '../../types';

function makeDiagram(overrides?: Partial<Diagram>): Diagram {
  const d = createEmptyDiagram('crt', 'save-test');
  d.nodes = [
    {
      id: 'n1',
      type: 'entity',
      position: { x: 0, y: 0 },
      data: { label: 'Node 1', tags: ['ude'], junctionType: 'and' },
    },
  ];
  d.edges = [];
  return { ...d, ...overrides };
}

describe('saveSkyFile', () => {
  let clickedLink: { href: string; download: string } | null = null;
  let revokedUrl: string | null = null;

  beforeEach(() => {
    clickedLink = null;
    revokedUrl = null;

    // Ensure no showSaveFilePicker (legacy path)
    vi.stubGlobal('showSaveFilePicker', undefined);
    // Remove showSaveFilePicker from window if present
    delete (window as Record<string, unknown>).showSaveFilePicker;

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
      revokedUrl = url;
    });

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
        Object.defineProperty(anchor, 'click', {
          value: vi.fn(() => {
            clickedLink = { href: (anchor as unknown as { href: string }).href, download: (anchor as unknown as { download: string }).download };
          }),
        });
        return anchor;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to blob download when showSaveFilePicker is unavailable', async () => {
    await saveSkyFile(makeDiagram());

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickedLink).not.toBeNull();
    expect(clickedLink!.download).toBe('Untitled-Diagram.sky');
    expect(clickedLink!.href).toBe('blob:mock-url');
    expect(revokedUrl).toBe('blob:mock-url');
  });

  it('uses diagram name for the download filename', async () => {
    await saveSkyFile(makeDiagram({ name: 'My Cool Diagram' }));

    expect(clickedLink!.download).toBe('My-Cool-Diagram.sky');
  });

  it('sanitizes special characters in filename', async () => {
    await saveSkyFile(makeDiagram({ name: 'test/file<>name' }));

    expect(clickedLink!.download).toBe('testfilename.sky');
  });

  it('defaults to "diagram" when name is empty or whitespace', async () => {
    await saveSkyFile(makeDiagram({ name: '   ' }));

    expect(clickedLink!.download).toBe('diagram.sky');
  });

  it('uses showSaveFilePicker when available', async () => {
    const mockClose = vi.fn();
    const mockWrite = vi.fn();
    const mockHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: mockWrite,
        close: mockClose,
      }),
    };
    const mockPicker = vi.fn().mockResolvedValue(mockHandle);
    (window as Record<string, unknown>).showSaveFilePicker = mockPicker;

    await saveSkyFile(makeDiagram());

    expect(mockPicker).toHaveBeenCalledOnce();
    expect(mockWrite).toHaveBeenCalledOnce();
    expect(mockClose).toHaveBeenCalledOnce();
    // Should NOT fall through to blob download
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('silently returns when user cancels the file picker', async () => {
    const abortError = new DOMException('User cancelled', 'AbortError');
    const mockPicker = vi.fn().mockRejectedValue(abortError);
    (window as Record<string, unknown>).showSaveFilePicker = mockPicker;

    await saveSkyFile(makeDiagram());

    // Should not fall through to legacy download
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('falls back to blob download on non-abort picker error', async () => {
    const mockPicker = vi.fn().mockRejectedValue(new Error('Something broke'));
    (window as Record<string, unknown>).showSaveFilePicker = mockPicker;

    await saveSkyFile(makeDiagram());

    // Should fall through to legacy path
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(clickedLink).not.toBeNull();
  });
});
