/**
 * HWP HTML → FormBuilder schema parser
 * 
 * HWP exported HTML uses div.htb (table block) with absolutely-positioned div.hce (cells).
 * Each cell has style: left, top, width, height in mm.
 * Text content is in span.hrt elements.
 * Section headings (outside tables) are in div.hls with span elements.
 */

// Clean text: remove &nbsp;, normalize whitespace
function cleanText(text) {
  return (text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse a single HWP table block (div.htb)
function parseHtbTable(htb) {
  const cells = htb.querySelectorAll('.hce');
  if (!cells.length) return null;

  // Extract cell positions
  const cellData = [];
  cells.forEach(cell => {
    const style = cell.getAttribute('style') || '';
    const left = parseFloat(style.match(/left:\s*([0-9.]+)mm/)?.[1] || 0);
    const top = parseFloat(style.match(/top:\s*([0-9.]+)mm/)?.[1] || 0);
    const width = parseFloat(style.match(/width:\s*([0-9.]+)mm/)?.[1] || 0);
    const height = parseFloat(style.match(/height:\s*([0-9.]+)mm/)?.[1] || 0);

    // Extract text from span.hrt elements
    const spans = cell.querySelectorAll('.hrt');
    let text = '';
    spans.forEach(s => { text += cleanText(s.textContent); });
    text = text.trim();

    cellData.push({ left, top, width, height, text });
  });

  if (!cellData.length) return null;

  // Find unique top positions (rows) and left positions (columns)
  const TOLERANCE = 1.0; // mm tolerance for grouping
  function groupPositions(values) {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    const groups = [];
    sorted.forEach(v => {
      if (groups.length === 0 || v - groups[groups.length - 1] > TOLERANCE) {
        groups.push(v);
      }
    });
    return groups;
  }

  const rowPositions = groupPositions(cellData.map(c => c.top));
  const colPositions = groupPositions(cellData.map(c => c.left));

  // Helper: find which row/col index a value belongs to
  function findIndex(val, positions) {
    for (let i = 0; i < positions.length; i++) {
      if (Math.abs(val - positions[i]) <= TOLERANCE) return i;
    }
    return -1;
  }

  // Calculate colspan/rowspan
  function calcSpan(cellLeft, cellWidth, positions, type) {
    const startIdx = findIndex(cellLeft, positions);
    if (startIdx < 0) return { start: 0, span: 1 };
    const cellEnd = cellLeft + cellWidth;
    let span = 1;
    for (let i = startIdx + 1; i < positions.length; i++) {
      if (positions[i] < cellEnd - TOLERANCE) span++;
      else break;
    }
    return { start: startIdx, span };
  }

  // Build row/col grid
  const numCols = colPositions.length;
  const rows = rowPositions.map(() => []);

  cellData.forEach(c => {
    const rowIdx = findIndex(c.top, rowPositions);
    const { start: colIdx, span: colspan } = calcSpan(c.left, c.width, colPositions, 'col');
    const { span: rowspan } = calcSpan(c.top, c.height, rowPositions, 'row');

    if (rowIdx >= 0 && colIdx >= 0) {
      const hasText = c.text.length > 0;
      
      // Detect checkbox patterns: □남, ☐여, ◻목사, etc.
      const checkboxPattern = /[\u25a1\u25a2\u25fb\u25fd\u2610\u2611\u2612\u2713\u2714\u2715\u2716\u274e\u274f]/g;
      const hasCheckbox = checkboxPattern.test(c.text);
      
      if (hasCheckbox) {
        // Extract checkbox labels: split by checkbox chars and clean up
        const labels = c.text
          .split(/[\u25a1\u25a2\u25fb\u25fd\u2610\u2611\u2612\u2713\u2714\u2715\u2716\u274e\u274f]/)
          .map(s => s.replace(/[()（）/／·\s,，]/g, ' ').trim())
          .filter(s => s.length > 0);
        
        rows[rowIdx].push({
          type: 'checkbox',
          text: '',
          field: 'f_' + Math.random().toString(36).substr(2, 6),
          colspan: colspan,
          rowspan: rowspan,
          placeholder: '',
          options: labels,
          _colIdx: colIdx
        });
      } else {
        rows[rowIdx].push({
          type: hasText ? 'header' : 'text',
          text: c.text,
          field: hasText ? '' : 'f_' + Math.random().toString(36).substr(2, 6),
          colspan: colspan,
          rowspan: rowspan,
          placeholder: '',
          options: [],
          _colIdx: colIdx
        });
      }
    }
  });

  // Sort cells within each row by column index
  rows.forEach(row => row.sort((a, b) => a._colIdx - b._colIdx));

  // Remove helper _colIdx
  const cleanRows = rows
    .filter(row => row.length > 0)
    .map(row => ({
      cells: row.map(({ _colIdx, ...rest }) => rest)
    }));

  return { columns: numCols, rows: cleanRows };
}

/**
 * Parse full HWP HTML into FormBuilder sections
 */
export function parseHwpHtml(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const sections = [];
  
  // Find all page containers
  const pages = doc.querySelectorAll('.hpa');
  if (!pages.length) {
    // Try parsing the whole body
    const allTables = doc.querySelectorAll('.htb');
    allTables.forEach((htb, idx) => {
      const result = parseHtbTable(htb);
      if (result && result.rows.length > 0) {
        sections.push({
          id: `s${Date.now()}_${idx}`,
          title: `섹션 ${idx + 1}`,
          type: 'table',
          columns: result.columns,
          rows: result.rows
        });
      }
    });
    return sections;
  }

  pages.forEach(page => {
    const container = page.querySelector('.hcI') || page;
    const children = container.children;

    // Scan for section titles and tables
    let pendingTitle = '';
    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      // Check if it's a text line (section heading)
      if (child.classList.contains('hls')) {
        const text = cleanText(child.textContent);
        if (text && text.length < 100) {
          // Looks like a heading
          if (/^\d+\./.test(text) || /^[가-힣]/.test(text) || text.includes('상황') || text.includes('통계') || text.includes('현황') || text.includes('임원') || text.includes('교회') || text.includes('교역자') || text.includes('집계')) {
            pendingTitle = text;
          }
        }
      }

      // Check if it contains a table
      const htb = child.querySelector('.htb') || (child.classList.contains('htb') ? child : null);
      if (htb) {
        const result = parseHtbTable(htb);
        if (result && result.rows.length > 0) {
          sections.push({
            id: `s${Date.now()}_${sections.length}`,
            title: pendingTitle || `섹션 ${sections.length + 1}`,
            type: 'table',
            columns: result.columns,
            rows: result.rows
          });
          pendingTitle = '';
        }
      }
    }
  });

  // If no sections found, try direct table search
  if (sections.length === 0) {
    const allTables = doc.querySelectorAll('.htb');
    allTables.forEach((htb, idx) => {
      const result = parseHtbTable(htb);
      if (result && result.rows.length > 0) {
        sections.push({
          id: `s${Date.now()}_${idx}`,
          title: `섹션 ${idx + 1}`,
          type: 'table',
          columns: result.columns,
          rows: result.rows
        });
      }
    });
  }

  return sections;
}
