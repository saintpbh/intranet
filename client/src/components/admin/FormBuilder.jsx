import { useState, useRef } from 'react';
import API_BASE from '../../api';
import { parseHwpHtml } from '../../utils/hwpHtmlParser';

const CELL_TYPES = [
  { value: 'header', label: '라벨(고정)' },
  { value: 'text', label: '텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'date', label: '날짜' },
  { value: 'select', label: '드롭다운' },
  { value: 'checkbox', label: '체크박스' },
  { value: 'radio', label: '라디오' },
  { value: 'textarea', label: '장문입력' },
  { value: 'computed', label: '자동계산' },
];

const emptyCell = (type = 'text', text = '') => ({ type, text, field: '', colspan: 1, rowspan: 1, placeholder: '', options: [] });
const headerCell = (text, colspan = 1, rowspan = 1) => ({ type: 'header', text, field: '', colspan, rowspan, placeholder: '', options: [] });
const inputCell = (field, placeholder = '', type = 'text', colspan = 1) => ({ type, text: '', field, colspan, rowspan: 1, placeholder, options: [] });

// ===== Quick Table Presets =====
const TABLE_PRESETS = [
  {
    name: '📋 기본정보 (라벨+입력)',
    desc: '라벨-입력칸 2열 구조',
    create: () => ({
      title: '기본 정보', type: 'table', columns: 4,
      rows: [
        { cells: [headerCell('항목명', 1), inputCell('field1', '입력', 'text', 3)] },
        { cells: [headerCell('항목명', 1), inputCell('field2', '입력', 'text', 3)] },
        { cells: [headerCell('항목명', 1), inputCell('field3', '입력', 'text', 3)] },
      ]
    })
  },
  {
    name: '📊 통계표 (구분+남+여+계)',
    desc: '구분-남-여-합계 4열',
    create: () => ({
      title: '통계표', type: 'table', columns: 4,
      rows: [
        { cells: [headerCell('구 분'), headerCell('남'), headerCell('여'), headerCell('계')] },
        { cells: [headerCell('항목1'), inputCell('m1', '', 'number'), inputCell('f1', '', 'number'), inputCell('t1', '', 'number')] },
        { cells: [headerCell('항목2'), inputCell('m2', '', 'number'), inputCell('f2', '', 'number'), inputCell('t2', '', 'number')] },
        { cells: [headerCell('합 계'), inputCell('m_total', '', 'number'), inputCell('f_total', '', 'number'), inputCell('t_total', '', 'number')] },
      ]
    })
  },
  {
    name: '👤 임원 목록표',
    desc: '구분-성명-직분-소속 4열',
    create: () => ({
      title: '임원 현황', type: 'table', columns: 4,
      rows: [
        { cells: [headerCell('구 분'), headerCell('성 명'), headerCell('직 분'), headerCell('소속교회')] },
        ...'노회장,부노회장(목사),부노회장(장로),서기,부서기,회의록서기,회의록부서기,회계,부회계'.split(',').map((label, i) => ({
          cells: [headerCell(label), inputCell(`name_${i}`, '성명'), inputCell(`role_${i}`, '직분'), inputCell(`church_${i}`, '소속교회')]
        }))
      ]
    })
  },
  {
    name: '🏫 교회/학교 수 표',
    desc: '구분-교회수-구분-교회학교수',
    create: () => ({
      title: '소속교회수·교회학교수', type: 'table', columns: 4,
      rows: [
        { cells: [headerCell('구 분'), headerCell('교 회 수'), headerCell('구 분'), headerCell('교회학교수')] },
        { cells: [headerCell('조직교회'), inputCell('org_church', '', 'number'), headerCell('어린이/청소년'), inputCell('youth_school', '', 'number')] },
        { cells: [headerCell('미조직교회'), inputCell('unorg_church', '', 'number'), headerCell('대학/청년부'), inputCell('univ_school', '', 'number')] },
        { cells: [headerCell('합 계'), inputCell('church_total', '', 'number'), headerCell('합 계'), inputCell('school_total', '', 'number')] },
      ]
    })
  },
  {
    name: '🔢 빈 표 (행×열 직접 지정)',
    desc: '원하는 크기의 빈 표 생성',
    create: null // handled separately with dialog
  },
];

// ===== Quick Row Presets =====
const ROW_PRESETS = [
  { name: '라벨+입력(1:3)', create: (cols) => ({ cells: [headerCell('라벨'), inputCell('', '입력', 'text', Math.max(1, cols - 1))] }) },
  { name: '라벨+입력(1:1:1:1)', create: (cols) => ({ cells: Array.from({ length: cols }, (_, i) => i % 2 === 0 ? headerCell('라벨') : inputCell('', '입력')) }) },
  { name: '전체 라벨(헤더행)', create: (cols) => ({ cells: Array.from({ length: cols }, () => headerCell('라벨')) }) },
  { name: '전체 입력칸', create: (cols) => ({ cells: Array.from({ length: cols }, () => inputCell('', '입력')) }) },
];

const FormBuilder = ({ initialSchema, onSave, onBack, templateName: initName, templateDesc: initDesc }) => {
  const [name, setName] = useState(initName || '');
  const [description, setDescription] = useState(initDesc || '');
  const [sections, setSections] = useState(initialSchema?.sections || []);
  const [selectedCell, setSelectedCell] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showPresetDialog, setShowPresetDialog] = useState(false);
  const [customRows, setCustomRows] = useState(5);
  const [customCols, setCustomCols] = useState(4);
  const [showRowPreset, setShowRowPreset] = useState(null); // sIdx
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // --- Section ops ---
  const addSectionFromPreset = (preset) => {
    const data = preset.create();
    setSections(prev => [...prev, { id: `s${Date.now()}`, ...data }]);
  };

  const addCustomTable = () => {
    const r = parseInt(customRows) || 3;
    const c = parseInt(customCols) || 4;
    setSections(prev => [...prev, {
      id: `s${Date.now()}`, title: '새 표', type: 'table', columns: c,
      rows: Array.from({ length: r }, () => ({ cells: Array.from({ length: c }, () => emptyCell()) }))
    }]);
    setShowPresetDialog(false);
  };

  const addRepeaterSection = () => {
    setSections(prev => [...prev, {
      id: `s${Date.now()}`, title: '반복행 섹션', type: 'repeater', maxRows: 30,
      columns_def: [
        { field: 'name', label: '이름', type: 'text', width: '20%' },
        { field: 'detail1', label: '항목1', type: 'text', width: '20%' },
        { field: 'detail2', label: '항목2', type: 'text', width: '20%' },
        { field: 'detail3', label: '항목3', type: 'text', width: '20%' },
        { field: 'detail4', label: '항목4', type: 'text', width: '20%' },
      ]
    }]);
  };

  const updateSection = (sIdx, updates) => setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, ...updates } : s));

  const removeSection = (sIdx) => {
    if (!confirm('이 섹션을 삭제하시겠습니까?')) return;
    setSections(prev => prev.filter((_, i) => i !== sIdx));
    setSelectedCell(null);
  };

  const moveSection = (sIdx, dir) => {
    setSections(prev => {
      const arr = [...prev];
      const t = sIdx + dir;
      if (t < 0 || t >= arr.length) return arr;
      [arr[sIdx], arr[t]] = [arr[t], arr[sIdx]];
      return arr;
    });
  };

  const duplicateSection = (sIdx) => {
    setSections(prev => {
      const clone = JSON.parse(JSON.stringify(prev[sIdx]));
      clone.id = `s${Date.now()}`;
      clone.title += ' (복사)';
      return [...prev.slice(0, sIdx + 1), clone, ...prev.slice(sIdx + 1)];
    });
  };

  // --- Row ops ---
  const addRow = (sIdx, preset = null) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const newRow = preset ? preset.create(s.columns || 4) : { cells: Array.from({ length: s.columns || s.rows?.[0]?.cells?.length || 4 }, () => emptyCell()) };
      return { ...s, rows: [...s.rows, newRow] };
    }));
    setShowRowPreset(null);
  };

  const addBulkRows = (sIdx, count) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const cols = s.columns || s.rows?.[0]?.cells?.length || 4;
      const newRows = Array.from({ length: count }, () => ({ cells: Array.from({ length: cols }, () => emptyCell()) }));
      return { ...s, rows: [...s.rows, ...newRows] };
    }));
  };

  const removeRow = (sIdx, rIdx) => {
    setSections(prev => prev.map((s, i) => i !== sIdx ? s : { ...s, rows: s.rows.filter((_, j) => j !== rIdx) }));
    setSelectedCell(null);
  };

  const duplicateRow = (sIdx, rIdx) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const clone = JSON.parse(JSON.stringify(s.rows[rIdx]));
      return { ...s, rows: [...s.rows.slice(0, rIdx + 1), clone, ...s.rows.slice(rIdx + 1)] };
    }));
  };

  // --- Cell ops ---
  const updateCell = (sIdx, rIdx, cIdx, updates) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : {
      ...s, rows: s.rows.map((r, ri) => ri !== rIdx ? r : {
        ...r, cells: r.cells.map((c, ci) => ci === cIdx ? { ...c, ...updates } : c)
      })
    }));
  };

  const toggleCellType = (sIdx, rIdx, cIdx) => {
    const cell = sections[sIdx]?.rows?.[rIdx]?.cells?.[cIdx];
    if (!cell) return;
    updateCell(sIdx, rIdx, cIdx, { type: cell.type === 'header' ? 'text' : 'header' });
  };

  const addCellToRow = (sIdx, rIdx) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : {
      ...s, rows: s.rows.map((r, ri) => ri === rIdx ? { ...r, cells: [...r.cells, emptyCell()] } : r)
    }));
  };

  const removeCellFromRow = (sIdx, rIdx, cIdx) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : {
      ...s, rows: s.rows.map((r, ri) => ri !== rIdx ? r : { ...r, cells: r.cells.filter((_, ci) => ci !== cIdx) })
    }));
    setSelectedCell(null);
  };

  // --- Repeater ops ---
  const updateRepeaterCol = (sIdx, colIdx, updates) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : { ...s, columns_def: s.columns_def.map((c, ci) => ci === colIdx ? { ...c, ...updates } : c) }));
  };
  const addRepeaterCol = (sIdx) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : { ...s, columns_def: [...(s.columns_def || []), { field: `col${Date.now()}`, label: '새 열', type: 'text', width: '20%' }] }));
  };
  const removeRepeaterCol = (sIdx, colIdx) => {
    setSections(prev => prev.map((s, si) => si !== sIdx ? s : { ...s, columns_def: s.columns_def.filter((_, ci) => ci !== colIdx) }));
  };

  // --- HTML Import ---
  const handleHtmlImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const html = ev.target.result;
        const parsed = parseHwpHtml(html);
        if (parsed.length === 0) {
          alert('HTML에서 표를 찾지 못했습니다.\n한글(HWP)에서 내보낸 HTML 파일인지 확인해주세요.');
        } else {
          setSections(prev => [...prev, ...parsed]);
          if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
          alert(`${parsed.length}개 섹션을 불러왔습니다!\n\n💡 빈 셀(흰색) = 입력칸, 회색 셀 = 라벨\n셀을 더블클릭하면 라벨↔입력칸을 전환할 수 있습니다.`);
        }
      } catch (err) {
        console.error('HTML parse error:', err);
        alert('HTML 파싱 중 오류가 발생했습니다: ' + err.message);
      }
      setImporting(false);
    };
    reader.onerror = () => { alert('파일 읽기 실패'); setImporting(false); };
    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // reset for re-upload
  };

  // --- Save ---
  const handleSave = async () => {
    if (!name.trim()) { alert('양식 이름을 입력해주세요.'); return; }
    setSaving(true);
    const schema = JSON.stringify({ title: name, sections });
    if (onSave) await onSave(name, description, schema);
    setSaving(false);
  };

  const sel = selectedCell;
  const selCellData = sel ? sections[sel.sIdx]?.rows?.[sel.rIdx]?.cells?.[sel.cIdx] : null;
  const S = { padding: '6px 10px', border: '1px solid #C6C6C8', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', gap: 16, minHeight: '70vh' }}>
      {/* Left: Editor */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#007AFF', cursor: 'pointer', fontSize: 14 }}>← 목록으로</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="file" accept=".html,.htm" ref={fileInputRef} onChange={handleHtmlImport} style={{ display: 'none' }} />
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importing}
              style={{ fontSize: 13, padding: '6px 14px', borderColor: '#34C759', color: '#34C759' }}>
              {importing ? '불러오는 중...' : '📄 HTML 불러오기'}
            </button>
            <button className="btn btn-outline" onClick={() => setPreviewMode(!previewMode)} style={{ fontSize: 13, padding: '6px 14px' }}>
              {previewMode ? '🛠 편집모드' : '👁 미리보기'}
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 13, padding: '6px 14px' }}>
              {saving ? '저장 중...' : '💾 저장'}
            </button>
          </div>
        </div>

        {/* Name/Desc */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: '#8E8E93', display: 'block', marginBottom: 4 }}>양식 이름 *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 노회 상황 통계표" style={{ ...S, width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#8E8E93', display: 'block', marginBottom: 4 }}>설명</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="간단한 설명" style={{ ...S, width: '100%' }} />
          </div>
        </div>

        {/* Tip */}
        {sections.length === 0 && !previewMode && (
          <div style={{ textAlign: 'center', padding: 40, background: '#F2F2F7', borderRadius: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📐</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>아래 프리셋을 선택하거나, HTML 파일을 불러오세요!</h3>
            <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 12 }}>복잡한 표도 프리셋으로 뼈대를 잡고 라벨만 수정하면 됩니다.</p>
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}
              style={{ fontSize: 14, padding: '10px 24px', borderColor: '#34C759', color: '#34C759', fontWeight: 600 }}>
              📄 한글(HWP) HTML 파일 불러오기
            </button>
            <p style={{ fontSize: 11, color: '#C7C7CC', marginTop: 8 }}>한글에서 다른이름으로 저장 → HTML로 저장한 파일을 선택하세요</p>
          </div>
        )}

        {/* Sections */}
        {sections.map((section, sIdx) => (
          <div key={section.id} style={{ marginBottom: 20, background: '#fff', borderRadius: 12, border: '1px solid #D1D1D6', overflow: 'hidden' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#F2F2F7', borderBottom: '1px solid #D1D1D6' }}>
              <span style={{ cursor: 'pointer', fontSize: 14, opacity: 0.6 }} onClick={() => moveSection(sIdx, -1)} title="위로">⬆</span>
              <span style={{ cursor: 'pointer', fontSize: 14, opacity: 0.6 }} onClick={() => moveSection(sIdx, 1)} title="아래로">⬇</span>
              <input type="text" value={section.title} onChange={e => updateSection(sIdx, { title: e.target.value })} style={{ ...S, flex: 1, fontWeight: 600, fontSize: 14, background: 'transparent', border: '1px solid transparent' }} onFocus={e => e.target.style.border = '1px solid #007AFF'} onBlur={e => e.target.style.border = '1px solid transparent'} />
              <span style={{ fontSize: 10, color: '#8E8E93', padding: '2px 6px', background: '#E5E5EA', borderRadius: 6 }}>{section.type === 'table' ? '표' : '반복행'}</span>
              <button onClick={() => duplicateSection(sIdx)} title="섹션 복사" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.5 }}>📋</button>
              <button onClick={() => removeSection(sIdx)} title="섹션 삭제" style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>

            {/* Table type - EDIT MODE */}
            {section.type === 'table' && !previewMode && (
              <div style={{ padding: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {section.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.cells.map((cell, cIdx) => {
                          const isSel = sel?.sIdx === sIdx && sel?.rIdx === rIdx && sel?.cIdx === cIdx;
                          const isHeader = cell.type === 'header';
                          return (
                            <td key={cIdx} colSpan={cell.colspan} rowSpan={cell.rowspan}
                              onClick={() => setSelectedCell({ sIdx, rIdx, cIdx })}
                              onDoubleClick={() => toggleCellType(sIdx, rIdx, cIdx)}
                              style={{
                                border: `1px solid ${isSel ? '#007AFF' : '#D1D1D6'}`,
                                background: isSel ? '#DCEAFF' : (isHeader ? '#F2F2F7' : '#fff'),
                                outline: isSel ? '2px solid #007AFF' : 'none',
                                padding: '4px 6px', verticalAlign: 'middle', cursor: 'pointer', minWidth: 50, position: 'relative',
                              }}>
                              {isHeader ? (
                                <input type="text" value={cell.text} onChange={e => updateCell(sIdx, rIdx, cIdx, { text: e.target.value })}
                                  style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
                                  placeholder="라벨 입력"
                                  onClick={e => e.stopPropagation()} />
                              ) : cell.type === 'checkbox' || cell.type === 'radio' ? (
                                <div style={{ textAlign: 'center', padding: '2px 0', display: 'flex', flexWrap: 'wrap', gap: '2px 8px', justifyContent: 'center', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  {(cell.options && cell.options.length > 0) ? cell.options.map((opt, oi) => (
                                    <label key={oi} style={{ cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                      <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} name={`cb_${sel?.sIdx}_${sel?.rIdx}_${sel?.cIdx}`} style={{ cursor: 'pointer', accentColor: '#007AFF', margin: 0 }} />
                                      <span style={{ color: '#333' }}>{opt}</span>
                                    </label>
                                  )) : cell.text ? (
                                    <label style={{ cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} style={{ cursor: 'pointer', accentColor: '#007AFF', margin: 0 }} />
                                      <span style={{ color: '#333' }}>{cell.text}</span>
                                    </label>
                                  ) : (
                                    <span style={{ color: '#C7C7CC', fontSize: 10 }}>[{cell.type === 'radio' ? '라디오' : '체크박스'}]</span>
                                  )}
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '1px 0' }}>
                                  <div style={{ color: '#007AFF', fontSize: 10 }}>
                                    {cell.field || `[${CELL_TYPES.find(t => t.value === cell.type)?.label || '입력'}]`}
                                  </div>
                                  {cell.placeholder && (
                                    <div style={{ color: '#C7C7CC', fontSize: 9, fontStyle: 'italic', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {cell.placeholder}
                                    </div>
                                  )}
                                </div>
                              )}
                              {(cell.colspan > 1 || cell.rowspan > 1) && (
                                <span style={{ position: 'absolute', top: 1, right: 3, fontSize: 8, color: '#FF9500' }}>
                                  {cell.colspan > 1 ? `c${cell.colspan}` : ''}{cell.rowspan > 1 ? `r${cell.rowspan}` : ''}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ border: 'none', width: 50, padding: '0 2px', verticalAlign: 'middle' }}>
                          <button onClick={() => duplicateRow(sIdx, rIdx)} title="행 복사" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.5 }}>📋</button>
                          <button onClick={() => removeRow(sIdx, rIdx)} title="행 삭제" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: 12 }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Row add bar */}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {ROW_PRESETS.map((p, i) => (
                    <button key={i} onClick={() => addRow(sIdx, p)}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #D1D1D6', background: '#F9F9F9', cursor: 'pointer', color: '#333' }}
                      title={p.name}>+ {p.name}</button>
                  ))}
                  <button onClick={() => addBulkRows(sIdx, 5)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #D1D1D6', background: '#F9F9F9', cursor: 'pointer', color: '#007AFF' }}>+ 5행 추가</button>
                  <button onClick={() => addCellToRow(sIdx, (section.rows?.length || 1) - 1)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '1px solid #D1D1D6', background: '#F9F9F9', cursor: 'pointer', color: '#FF9500' }}>+ 열 추가(마지막행)</button>
                </div>
              </div>
            )}

            {/* Repeater type - EDIT MODE */}
            {section.type === 'repeater' && !previewMode && (
              <div style={{ padding: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 11, color: '#8E8E93' }}>최대 행수:</label>
                  <input type="number" value={section.maxRows || 20} onChange={e => updateSection(sIdx, { maxRows: parseInt(e.target.value) || 20 })} style={{ ...S, width: 60, padding: '4px 8px' }} />
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {(section.columns_def || []).map((col, ci) => (
                        <th key={ci} style={{ border: '1px solid #D1D1D6', padding: '6px 4px', background: '#F2F2F7' }}>
                          <input type="text" value={col.label} onChange={e => updateRepeaterCol(sIdx, ci, { label: e.target.value })} style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 600, fontSize: 12, textAlign: 'center', outline: 'none', fontFamily: 'inherit' }} />
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'center' }}>
                            <select value={col.type} onChange={e => updateRepeaterCol(sIdx, ci, { type: e.target.value })} style={{ fontSize: 9, padding: '1px 2px' }}>
                              {CELL_TYPES.filter(t => !['header', 'computed'].includes(t.value)).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <button onClick={() => removeRepeaterCol(sIdx, ci)} style={{ background: 'none', border: 'none', color: '#FF3B30', cursor: 'pointer', fontSize: 10 }}>✕</button>
                          </div>
                        </th>
                      ))}
                      <th style={{ width: 32, border: 'none' }}><button onClick={() => addRepeaterCol(sIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>➕</button></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>{(section.columns_def || []).map((_, ci) => <td key={ci} style={{ border: '1px solid #D1D1D6', padding: 6, color: '#C7C7CC', textAlign: 'center', fontSize: 10 }}>(입력란)</td>)}</tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* PREVIEW MODE */}
            {previewMode && section.type === 'table' && (
              <div style={{ padding: 10 }}>
                <table className="report-table">
                  <tbody>
                    {section.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.cells.map((cell, cIdx) => (
                          <td key={cIdx} colSpan={cell.colspan} rowSpan={cell.rowspan}
                            style={{ background: cell.type === 'header' ? '#F2F2F7' : '#fff', fontWeight: cell.type === 'header' ? 700 : 400, fontSize: 12, padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            {cell.type === 'header' ? cell.text : (cell.type === 'checkbox' || cell.type === 'radio') ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', justifyContent: 'center', alignItems: 'center' }}>
                                {(cell.options && cell.options.length > 0) ? cell.options.map((opt, oi) => (
                                  <label key={oi} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, whiteSpace: 'nowrap' }}>
                                    <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} style={{ accentColor: '#007AFF', margin: 0 }} />
                                    <span>{opt}</span>
                                  </label>
                                )) : cell.text ? (
                                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
                                    <input type={cell.type === 'radio' ? 'radio' : 'checkbox'} style={{ accentColor: '#007AFF', margin: 0 }} />
                                    <span>{cell.text}</span>
                                  </label>
                                ) : null}
                              </div>
                            ) : (
                              <input type={cell.type === 'number' ? 'number' : 'text'} placeholder={cell.placeholder || cell.field || ''} style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, textAlign: 'center', color: '#333' }} readOnly />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {previewMode && section.type === 'repeater' && (
              <div style={{ padding: 10 }}>
                <table className="report-table">
                  <thead><tr><th style={{ width: 40 }}>연번</th>{(section.columns_def || []).map((col, ci) => <th key={ci}>{col.label}</th>)}</tr></thead>
                  <tbody>{Array.from({ length: 3 }, (_, i) => <tr key={i}><td>{i + 1}</td>{(section.columns_def || []).map((col, ci) => <td key={ci}><input type="text" placeholder={col.label} readOnly style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12 }} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* ===== Add Section Area ===== */}
        {!previewMode && (
          <div style={{ background: '#F2F2F7', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#007AFF' }}>➕ 섹션 추가</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
              {TABLE_PRESETS.map((preset, i) => (
                <button key={i} onClick={() => preset.create ? addSectionFromPreset(preset) : setShowPresetDialog(true)}
                  style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid #D1D1D6', borderRadius: 10, background: '#fff', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.borderColor = '#007AFF'}
                  onMouseOut={e => e.currentTarget.style.borderColor = '#D1D1D6'}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{preset.name}</div>
                  <div style={{ fontSize: 11, color: '#8E8E93' }}>{preset.desc}</div>
                </button>
              ))}
              <button onClick={addRepeaterSection}
                style={{ textAlign: 'left', padding: '10px 14px', border: '1px solid #D1D1D6', borderRadius: 10, background: '#fff', cursor: 'pointer' }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#007AFF'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#D1D1D6'}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>📋 반복행 섹션</div>
                <div style={{ fontSize: 11, color: '#8E8E93' }}>동적 행 추가 (장로 목록 등)</div>
              </button>
            </div>
          </div>
        )}

        {/* Custom table dialog */}
        {showPresetDialog && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: 320 }}>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>빈 표 만들기</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#8E8E93' }}>행 수</label>
                  <input type="number" min="1" max="100" value={customRows} onChange={e => setCustomRows(e.target.value)} style={{ ...S, width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8E8E93' }}>열 수</label>
                  <input type="number" min="1" max="20" value={customCols} onChange={e => setCustomCols(e.target.value)} style={{ ...S, width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setShowPresetDialog(false)} style={{ padding: '8px 16px' }}>취소</button>
                <button className="btn btn-primary" onClick={addCustomTable} style={{ padding: '8px 16px' }}>생성</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Cell Property Panel */}
      {!previewMode && (
        <div style={{ width: 260, background: '#fff', borderRadius: 12, border: '1px solid #D1D1D6', padding: 14, alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#007AFF' }}>🛠 셀 속성</h4>
          {selCellData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: '#8E8E93' }}>셀 유형</label>
                <select value={selCellData.type} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { type: e.target.value })} style={{ ...S, width: '100%', fontSize: 12 }}>
                  {CELL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {selCellData.type === 'header' && (
                <div>
                  <label style={{ fontSize: 10, color: '#8E8E93' }}>표시 텍스트</label>
                  <input type="text" value={selCellData.text || ''} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { text: e.target.value })} style={{ ...S, width: '100%', fontSize: 12 }} />
                </div>
              )}
              {['checkbox', 'radio'].includes(selCellData.type) && (
                <div>
                  <label style={{ fontSize: 10, color: '#8E8E93' }}>체크박스 라벨</label>
                  <input type="text" value={selCellData.text || ''} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { text: e.target.value })} placeholder="예: 남, 여, 목사" style={{ ...S, width: '100%', fontSize: 12 }} />
                </div>
              )}
              {selCellData.type !== 'header' && (
                <>
                  <div>
                    <label style={{ fontSize: 10, color: '#8E8E93' }}>필드명</label>
                    <input type="text" value={selCellData.field || ''} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { field: e.target.value })} placeholder="예: church_name" style={{ ...S, width: '100%', fontSize: 12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: '#8E8E93' }}>📝 안내문구 <span style={{ color: '#C7C7CC' }}>(회색 글자)</span></label>
                    <input type="text" value={selCellData.placeholder || ''} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { placeholder: e.target.value })} placeholder="예: 교회명을 입력하세요" style={{ ...S, width: '100%', fontSize: 12 }} />
                  </div>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#8E8E93' }}>Colspan</label>
                  <input type="number" min="1" value={selCellData.colspan || 1} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { colspan: parseInt(e.target.value) || 1 })} style={{ ...S, width: '100%', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#8E8E93' }}>Rowspan</label>
                  <input type="number" min="1" value={selCellData.rowspan || 1} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { rowspan: parseInt(e.target.value) || 1 })} style={{ ...S, width: '100%', fontSize: 12 }} />
                </div>
              </div>
              {['select', 'checkbox', 'radio'].includes(selCellData.type) && (
                <div>
                  <label style={{ fontSize: 10, color: '#8E8E93' }}>옵션 (콤마 구분)</label>
                  <input type="text" value={(selCellData.options || []).join(',')} onChange={e => updateCell(sel.sIdx, sel.rIdx, sel.cIdx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="옵션1,옵션2" style={{ ...S, width: '100%', fontSize: 12 }} />
                </div>
              )}
              <div style={{ borderTop: '1px solid #E5E5EA', paddingTop: 8, marginTop: 4, display: 'flex', gap: 4 }}>
                <button onClick={() => toggleCellType(sel.sIdx, sel.rIdx, sel.cIdx)} style={{ flex: 1, fontSize: 11, padding: '5px', border: '1px solid #D1D1D6', borderRadius: 6, background: '#F9F9F9', cursor: 'pointer' }}>
                  {selCellData.type === 'header' ? '→ 입력칸 변환' : '→ 라벨 변환'}
                </button>
                <button onClick={() => removeCellFromRow(sel.sIdx, sel.rIdx, sel.cIdx)} style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #FF3B30', borderRadius: 6, background: 'rgba(255,59,48,0.06)', color: '#FF3B30', cursor: 'pointer' }}>삭제</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>
              셀을 <b>클릭</b>하면 속성 편집<br />
              <b>더블클릭</b>하면 라벨↔입력 전환<br />
              <span style={{ fontSize: 10, marginTop: 8, display: 'block', color: '#C7C7CC' }}>라벨 셀은 텍스트를 바로 수정 가능</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FormBuilder;
