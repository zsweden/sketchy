import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const APP_URL = 'http://localhost:5175/';
const FILES = [
  '/Users/ziadismail/Desktop/TEST FILES /Sketchy/Convoy.sky',
  '/Users/ziadismail/Desktop/TEST FILES /Sketchy/ZuoraLoop.sky',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 } });

  const results = [];
  for (const filePath of FILES) {
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const name = raw.name === 'Untitled Diagram'
      ? filePath.split('/').pop().replace(/\.sky$/i, '')
      : raw.name;

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });

    const input = page.locator('input[type="file"][accept=".sky,.json"]');
    await input.setInputFiles(filePath);
    await page.waitForTimeout(400);
    await page.locator('[data-testid="diagram-flow"]').waitFor();
    await page.getByRole('button', { name: 'Auto-layout' }).click();
    await page.waitForTimeout(1200);

    const fixedMetrics = await collectMetrics(page, raw.edges);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Arrow routing').selectOption('dynamic');
    await page.waitForTimeout(400);

    const dynamicMetrics = await collectMetrics(page, raw.edges);
    results.push({
      file: name,
      nodes: raw.nodes.length,
      edges: raw.edges.length,
      fixedCrossings: fixedMetrics.edgeCrossings,
      dynamicCrossings: dynamicMetrics.edgeCrossings,
      fixedEdgeNode: fixedMetrics.edgeNodeOverlaps,
      dynamicEdgeNode: dynamicMetrics.edgeNodeOverlaps,
      fixedLength: fixedMetrics.totalEdgeLength,
      dynamicLength: dynamicMetrics.totalEdgeLength,
    });
  }

  console.table(results);

  for (const row of results) {
    console.log(row.file, JSON.stringify({
      crossings_delta: pctDelta(row.fixedCrossings, row.dynamicCrossings),
      edge_node_delta: pctDelta(row.fixedEdgeNode, row.dynamicEdgeNode),
      edge_length_delta: pctDelta(row.fixedLength, row.dynamicLength),
    }, null, 2));
  }

  await browser.close();
}

function pctDelta(from, to) {
  if (from === 0) {
    return to === 0 ? '0.0%' : 'n/a';
  }
  const value = ((from - to) / from) * 100;
  const sign = value >= 0 ? '' : '+';
  return `${sign}${value.toFixed(1)}%`;
}

async function collectMetrics(page, edges) {
  return page.evaluate((diagramEdges) => {
    const nodeEls = Array.from(document.querySelectorAll('[data-node-id]'));
    const nodeBoxes = new Map(
      nodeEls.map((el) => {
        const id = el.getAttribute('data-node-id');
        const rect = el.getBoundingClientRect();
        return [id, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }];
      }),
    );

    const edgeEls = Array.from(document.querySelectorAll('.react-flow__edge'));
    const edgeInfos = edgeEls.map((edgeEl) => {
      const id = edgeEl.getAttribute('data-id');
      const path = edgeEl.querySelector('.react-flow__edge-path');
      return { id, path };
    }).filter((entry) => entry.id && entry.path);

    const pathPolylines = edgeInfos.map((entry) => {
      const edge = diagramEdges.find((candidate) => candidate.id === entry.id)
        ?? diagramEdges.find((candidate, index) => `${candidate.source}-${candidate.target}-${index}` === entry.id)
        ?? diagramEdges.find((candidate) => entry.id.startsWith(`${candidate.source}-${candidate.target}`));

      const totalLength = entry.path.getTotalLength();
      const step = Math.max(6, Math.min(12, totalLength / 30));
      const points = [];
      for (let dist = 0; dist <= totalLength; dist += step) {
        const point = entry.path.getPointAtLength(dist);
        points.push({ x: point.x, y: point.y });
      }
      const lastPoint = entry.path.getPointAtLength(totalLength);
      const tail = points[points.length - 1];
      if (!tail || tail.x !== lastPoint.x || tail.y !== lastPoint.y) {
        points.push({ x: lastPoint.x, y: lastPoint.y });
      }

      return { id: entry.id, edge, points, totalLength };
    }).filter((entry) => entry.edge);

    let edgeCrossings = 0;
    for (let i = 0; i < pathPolylines.length; i++) {
      for (let j = i + 1; j < pathPolylines.length; j++) {
        const a = pathPolylines[i];
        const b = pathPolylines[j];
        if (sharesEndpoint(a.edge, b.edge)) continue;
        if (polylineIntersects(a.points, b.points)) {
          edgeCrossings++;
        }
      }
    }

    let edgeNodeOverlaps = 0;
    for (const path of pathPolylines) {
      for (const [nodeId, box] of nodeBoxes.entries()) {
        if (nodeId === path.edge.source || nodeId === path.edge.target) continue;
        if (polylineIntersectsBox(path.points, box)) {
          edgeNodeOverlaps++;
        }
      }
    }

    const totalEdgeLength = round(pathPolylines.reduce((sum, path) => sum + path.totalLength, 0));
    return { edgeCrossings, edgeNodeOverlaps, totalEdgeLength };
  }, edges);
}

function polylineIntersects(pointsA, pointsB) {
  for (let i = 0; i < pointsA.length - 1; i++) {
    for (let j = 0; j < pointsB.length - 1; j++) {
      if (segmentsIntersect(pointsA[i], pointsA[i + 1], pointsB[j], pointsB[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

function polylineIntersectsBox(points, box) {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentIntersectsBox(points[i], points[i + 1], box)) {
      return true;
    }
  }
  return false;
}

function sharesEndpoint(a, b) {
  return a.source === b.source
    || a.source === b.target
    || a.target === b.source
    || a.target === b.target;
}

function orientation(p, q, r) {
  return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
}

function onSegment(p, q, r) {
  return q.x <= Math.max(p.x, r.x)
    && q.x >= Math.min(p.x, r.x)
    && q.y <= Math.max(p.y, r.y)
    && q.y >= Math.min(p.y, r.y);
}

function segmentsIntersect(p1, q1, p2, q2) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
    return true;
  }
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

function pointInBox(point, box) {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function segmentIntersectsBox(from, to, box) {
  if (pointInBox(from, box) || pointInBox(to, box)) return true;

  const topLeft = { x: box.left, y: box.top };
  const topRight = { x: box.right, y: box.top };
  const bottomLeft = { x: box.left, y: box.bottom };
  const bottomRight = { x: box.right, y: box.bottom };

  return segmentsIntersect(from, to, topLeft, topRight)
    || segmentsIntersect(from, to, topRight, bottomRight)
    || segmentsIntersect(from, to, bottomRight, bottomLeft)
    || segmentsIntersect(from, to, bottomLeft, topLeft);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
