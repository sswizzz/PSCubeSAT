import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { useConfirm } from '../components/classes/use-confirm';
import { InlineQuestionBank } from './QuestionBankPage';

const labels = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', quiz: 'Câu hỏi', labtest: 'Lab test' };
const fields = {
  video: [['url', 'URL video', 'url'], ['watch_ratio', 'Tỷ lệ xem (0–1)', 'number'], ['duration_seconds', 'Thời lượng (giây)', 'number'], ['tracking_mode', 'Ghi nhận', 'tracking'], ['confirmation_allowed', 'SV tự xác nhận', 'boolean']],
  document: [['markdown', 'Nội dung (Markdown)', 'textarea']],
  practice: [['instructions', 'Hướng dẫn', 'textarea'], ['rubric', 'Tiêu chí chấm', 'textarea'], ['evidence', 'Minh chứng đầu ra', 'textarea'], ['board', 'Bo mạch', 'board']],
  quiz: [
    ['num_questions', 'Số câu/lượt', 'number'],
    ['time_limit_minutes', 'Thời gian (phút)', 'number'],
    ['max_attempts', 'Số lượt', 'attempts'],
    ['cooldown_minutes', 'Chờ hết lượt (phút)', 'cooldown'],
    ['pass_score', 'Điểm đạt (số câu)', 'number'],
  ],
  labtest: [
    ['num_questions', 'Số câu/lượt', 'number'],
    ['time_limit_minutes', 'Thời gian (phút)', 'number'],
    ['max_attempts', 'Số lượt', 'attempts'],
    ['cooldown_minutes', 'Chờ hết lượt (phút)', 'cooldown'],
    ['pass_score', 'Điểm đạt (số câu)', 'number'],
  ],
};

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
    reader.onerror = () => reject(new Error('Không đọc được tệp.'));
    reader.readAsDataURL(file);
  });
}

function LessonSettings({ lesson, labId, classId, onChange, onReload, onBankChange, refreshKey, disabled, labOpened }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState({});
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  async function importDocument(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(docx|pdf)$/i.test(file.name)) {
      setImportNotice({ error: 'Chọn tệp .docx hoặc .pdf. Word cũ (.doc) hãy mở bằng Word và lưu lại thành .docx.' });
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setImportNotice({ error: 'Tệp vượt quá giới hạn 10 MB.' });
      return;
    }
    const current = lesson.params.markdown ?? lesson.content.markdown ?? '';
    if (current.trim() && !(await askConfirm({
      title: 'Thay thế nội dung tài liệu?',
      message: `Nội dung đang soạn sẽ được thay bằng nội dung đọc từ tệp “${file.name}”. Bạn vẫn có thể chỉnh sửa trước khi lưu nháp.`,
      confirmLabel: 'Thay thế',
      tone: 'info',
    }))) return;
    setImporting(true);
    setImportNotice({});
    try {
      const result = await request(`/api/classes/${classId}/document-import`, {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, content: await fileToBase64(file) }),
      });
      param('markdown', result.markdown);
      setImportNotice({ message: `Đã nhập ${result.characters.toLocaleString('vi-VN')} ký tự từ ${file.name}. Hãy xem lại nội dung rồi bấm Lưu nháp. ${(result.warnings || []).join(' ')}` });
    } catch (error) {
      setImportNotice({ error: error.message });
    } finally {
      setImporting(false);
    }
  }
  function param(key, value) {
    const params = { ...lesson.params };
    if (value === '') delete params[key]; else params[key] = value;
    onChange({ ...lesson, params });
  }
  const bankReadyOrAuto = Boolean(lesson.content.bank_ready || lesson.content.bank_auto_publishable);
  const todos = (lesson.content.todos || []).filter(
    todo => !(
      (lesson.type === 'labtest' || lesson.type === 'quiz')
      && bankReadyOrAuto
      && (todo.includes('ngân hàng') || todo.includes('câu hỏi kiểm tra'))
    )
  );
  return <details
    className="curriculum-lesson"
    open={open}
    onToggle={event => {
      const next = event.currentTarget.open;
      setOpen(next);
      if (next) setEverOpened(true);
    }}
  >
    <summary className="curriculum-lesson-summary">
      <span className="curriculum-lesson-main">
        <span className={`curriculum-type is-${lesson.type}`}>{labels[lesson.type]}</span>
        <strong className="curriculum-lesson-title">{lesson.title}</strong>
      </span>
      <span className={`curriculum-lesson-state${!lesson.enabled ? ' is-off' : lesson.required ? ' is-req' : ''}`}>
        {lesson.enabled ? (lesson.required ? 'Bắt buộc' : 'Tùy chọn') : 'Đã tắt'}
      </span>
    </summary>
    <fieldset disabled={disabled}>
      <legend className="sr-only">Cấu hình {lesson.title}</legend>
      <div className="curriculum-switches">
        <label><input type="checkbox" checked={lesson.enabled} onChange={event => onChange({ ...lesson, enabled: event.target.checked })} />Bật bài</label>
        <label><input type="checkbox" checked={lesson.required} onChange={event => onChange({ ...lesson, required: event.target.checked })} />Bắt buộc</label>
        <label>Thứ tự<input type="number" min={0} max={1000} value={lesson.order_no} onChange={event => onChange({ ...lesson, order_no: Number(event.target.value) })} /></label>
        <code className="curriculum-lesson-id">{lesson.id}</code>
      </div>
      {todos.length > 0 && <div className="curriculum-todo">{todos.map(todo => <p key={todo}>{todo}</p>)}</div>}
      {lesson.content?.description && <p className="lms-secondary">{lesson.content.description}</p>}
      {(lesson.content?.exercises?.length || 0) > 1 && (
        <ul className="curriculum-subexercises" aria-label="Các bài thực hành con">
          {lesson.content.exercises.map(ex => (
            <li key={ex.id}><code>{ex.id}</code><span> — {ex.description || ex.title}</span></li>
          ))}
        </ul>
      )}
      {(lesson.type === 'labtest' || lesson.type === 'quiz') && (
        lesson.content.bank_ready ? (
          <p className="lesson-achieved">✓ Ngân hàng đã xuất bản.</p>
        ) : lesson.content.bank_auto_publishable ? (
          <p className="lesson-achieved">
            ✓ {lesson.content.bank_approved_count} câu sẵn sàng (tự xuất bản cùng lớp).
          </p>
        ) : (lesson.content.bank_draft_count || 0) > 0 ? (
          <p className="lms-notice lms-error" role="status">
            Còn {lesson.content.bank_draft_count} câu nháp chưa duyệt.
          </p>
        ) : null
      )}
      {lesson.type === 'video' && <p className="lms-secondary">YouTube/Vimeo: chọn &ldquo;SV xác nhận&rdquo;. MP4/WebM: chọn &ldquo;Đo đoạn xem&rdquo; + thời lượng.</p>}
      {lesson.type === 'quiz' && !bankReadyOrAuto && (
        <p className="lms-secondary">Nạp câu hỏi mẫu hoặc soạn câu hỏi bên dưới.</p>
      )}
      {lesson.type === 'document' && <div className="lms-import-box">
        <label>Nhập .docx / .pdf
          <input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={importing} onChange={importDocument} />
        </label>
        <p className="lms-secondary">Tối đa 10 MB, không gồm ảnh. {importing && 'Đang đọc…'}</p>
        <Notice {...importNotice} />
      </div>}
      <div className="lms-form-grid">{[...fields[lesson.type], ['estimated_minutes', 'Dự kiến (phút)', 'number']].map(([key, label, kind]) => {
        const hasParam = Object.prototype.hasOwnProperty.call(lesson.params, key);
        const value = hasParam ? lesson.params[key] : (lesson.content[key] ?? '');
        if (kind === 'attempts') {
          const isUnlimited = value === null;
          const fallbackAttempts = lesson.type === 'labtest' ? 5 : 3;
          return <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--cubesat-ink)' }}>{label}</span>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isUnlimited}
                onChange={event => {
                  const nextParams = { ...lesson.params };
                  if (event.target.checked) {
                    nextParams.max_attempts = null;
                    nextParams.cooldown_minutes = 0;
                  } else {
                    nextParams.max_attempts = fallbackAttempts;
                  }
                  onChange({ ...lesson, params: nextParams });
                }}
              />
              <span>Không giới hạn lượt</span>
            </label>
            {!isUnlimited && (
              <input
                type="number"
                aria-label={label}
                min={1}
                max={100}
                step="1"
                value={value === '' ? '' : value}
                onChange={event => param(key, event.target.value === '' ? '' : Number(event.target.value))}
              />
            )}
          </div>;
        }
        if (kind === 'cooldown') {
          const effectiveAttempts = Object.prototype.hasOwnProperty.call(lesson.params, 'max_attempts')
            ? lesson.params.max_attempts
            : lesson.content.max_attempts;
          const isUnlimited = effectiveAttempts === null;
          return <label key={key}>{label}
            <input
              type="number"
              min={0}
              max={1440}
              step="1"
              disabled={isUnlimited}
              value={isUnlimited ? 0 : (value === '' ? '' : value)}
              onChange={event => param(key, event.target.value === '' ? '' : Number(event.target.value))}
            />
            <small className="lms-secondary">0 = khóa khi hết lượt.</small>
          </label>;
        }
        const numberBounds = key === 'watch_ratio'
          ? { min: 0, max: 1, step: '0.05' }
          : key === 'pass_score' || key === 'num_questions'
          ? { min: 1, max: 200, step: '1' }
          : key === 'time_limit_minutes'
          ? { min: 1, max: 180, step: '1' }
          : { min: 0, max: 7200, step: '1' };
        return <label key={key} className={kind === 'textarea' ? 'lms-wide' : ''}>{label}
          {kind === 'boolean' ? <input type="checkbox" checked={!!value} onChange={event => param(key, event.target.checked)} />
            : kind === 'tracking' ? <select value={value || 'native'} onChange={event => param(key, event.target.value)}><option value="native">Đo đoạn xem (video .mp4/.webm)</option><option value="confirmation">SV xác nhận (nguồn không đo được)</option></select>
            : kind === 'textarea' ? <textarea rows={8} maxLength={100000} value={value} onChange={event => param(key, event.target.value)} />
            : kind === 'board' ? <select value={value} onChange={event => param(key, event.target.value)}><option value="">Theo lựa chọn của người học</option><option value="esp32">ESP32</option><option value="esp32s3">ESP32-S3</option></select>
              : <input type={kind} {...(kind === 'number' ? numberBounds : { maxLength: 2000 })} value={value} onChange={event => param(key, event.target.value === '' ? '' : kind === 'number' ? Number(event.target.value) : event.target.value)} />}
        </label>;
      })}</div>
    </fieldset>
    {(lesson.type === 'labtest' || lesson.type === 'quiz') && labOpened && everOpened && (
      <div className="lms-import-box" style={{ marginTop: '16px' }}>
        <InlineQuestionBank
          classId={classId}
          labId={labId}
          lessonId={lesson.type === 'quiz' ? lesson.id : null}
          onPublished={onReload}
          onBankChange={onBankChange}
          refreshKey={refreshKey}
        />
      </div>
    )}
    {confirmDialog}
  </details>;
}

function LabPanel({ lab, allLabs, classId, busy, updateLab, onReload, handleBankChange, bankRefreshKey }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const enabledCount = lab.lessons.filter(item => item.enabled).length;
  return <details
    className="lms-panel curriculum-lab"
    open={open}
    onToggle={event => {
      const next = event.currentTarget.open;
      setOpen(next);
      if (next) setEverOpened(true);
    }}
  >
    <summary>
      <h2><span className="curriculum-lab-num">Lab {lab.id}</span>{lab.title}</h2>
      <span className={`curriculum-lab-count${!lab.enabled ? ' is-off' : ''}`}>
        {!lab.enabled ? 'Đã tắt' : `${enabledCount}/${lab.lessons.length} bài`}
      </span>
    </summary>
    <div className="curriculum-lab-controls">
      <div className="curriculum-lab-top">
        <label className="curriculum-toggle">
          <input type="checkbox" disabled={busy} checked={lab.enabled} onChange={event => updateLab(lab.id, value => ({ ...value, enabled: event.target.checked }))} />
          <span>Bật lab</span>
        </label>
        <details className="curriculum-lab-meta">
          <summary>Thông tin lab</summary>
          <dl>
            <div><dt>Mục tiêu</dt><dd>{lab.objectives}</dd></div>
            <div><dt>Nhóm nội dung</dt><dd>{lab.groups.join(' → ') || 'Tổng quan'}</dd></div>
            <div><dt>Minh chứng</dt><dd>{lab.evidence}</dd></div>
          </dl>
        </details>
        <Link className="curriculum-lab-link" to={`/classes/${classId}/labs/${lab.id}/questions`}>Ngân hàng Lab Test →</Link>
      </div>
      <div className="curriculum-prereq-row" role="group" aria-label={`Lab tiên quyết cho Lab ${lab.id}`}>
        <span className="curriculum-prereq-label">Tiên quyết:</span>
        <div className="curriculum-prereq-chips">
          {allLabs.filter(item => item.id !== lab.id).map(item => {
            const checked = lab.prerequisites.includes(item.id);
            return (
              <label key={item.id} className={`curriculum-prereq-chip${checked ? ' is-selected' : ''}`} title={`Lab ${item.id}: ${item.title}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  disabled={busy}
                  checked={checked}
                  onChange={event => updateLab(lab.id, value => ({
                    ...value,
                    prerequisites: event.target.checked
                      ? [...new Set([...value.prerequisites, item.id])].sort((a, b) => a - b)
                      : value.prerequisites.filter(prereqId => prereqId !== item.id),
                  }))}
                />
                <span>Lab {item.id}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
    <div className="curriculum-lesson-list">
      {lab.lessons.map(lesson => <LessonSettings key={lesson.id} lesson={lesson} labId={lab.id} classId={classId} onReload={onReload} onBankChange={handleBankChange} refreshKey={bankRefreshKey} disabled={busy} labOpened={everOpened} onChange={next => updateLab(lab.id, value => ({ ...value, lessons: value.lessons.map(item => item.id === next.id ? next : item) }))} />)}
    </div>
  </details>;
}

function Editor({ initial, classId, onReload }) {
  const [config, setConfig] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const [errors, setErrors] = useState([]);
  const [impact, setImpact] = useState(null);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const handleBankChange = useCallback((targetLessonId, bank) => {
    if (!bank || !targetLessonId) return;
    const approvedCount = typeof bank.approved_count === 'number'
      ? bank.approved_count
      : (bank.questions || []).filter(q => q.status === 'approved').length;
    const draftCount = (bank.questions || []).filter(q => q.status === 'draft').length;
    const ready = bank.status === 'published';
    const autoPublishable = bank.status === 'draft' && approvedCount >= 1 && draftCount === 0;
    setConfig(current => {
      let changed = false;
      const labs = current.labs.map(lab => ({
        ...lab,
        lessons: lab.lessons.map(item => {
          if (item.id !== targetLessonId) return item;
          const c = item.content;
          if (
            c.bank_ready === ready
            && c.bank_status === bank.status
            && c.bank_approved_count === approvedCount
            && c.bank_draft_count === draftCount
            && c.bank_auto_publishable === autoPublishable
          ) {
            return item;
          }
          changed = true;
          return {
            ...item,
            content: {
              ...c,
              bank_ready: ready,
              bank_status: bank.status,
              bank_approved_count: approvedCount,
              bank_draft_count: draftCount,
              bank_auto_publishable: autoPublishable,
            },
          };
        }),
      }));
      return changed ? { ...current, labs } : current;
    });
  }, []);
  function updateLab(id, callback) {
    setConfig(current => ({ ...current, labs: current.labs.map(lab => lab.id === id ? callback(lab) : lab) }));
    setDirty(true); setImpact(null); setErrors([]); setNotice({});
  }
  async function save() {
    setBusy(true); setNotice({}); setErrors([]); setImpact(null);
    try {
      const payload = { course_version_id: config.course_version_id, expected_version: config.version,
        labs: config.labs.map(lab => ({ lab_id: lab.id, enabled: lab.enabled, prerequisites: lab.prerequisites })),
        lessons: config.labs.flatMap(lab => lab.lessons.map(item => ({ lesson_id: item.id, enabled: item.enabled, required: item.required, order_no: item.order_no, params: item.params }))) };
      const next = await request(`/api/classes/${classId}/settings`, { method: 'PUT', body: JSON.stringify(payload) });
      setConfig(next); setDirty(false); setNotice({ message: 'Đã lưu nháp. Nội dung sinh viên đang thấy chưa thay đổi.' });
    } catch (failure) { setNotice({ error: failure.message }); setErrors(failure.details?.errors || []); }
    finally { setBusy(false); }
  }
  function applyPath(kind) {
    const branch = { 0: [], 1: [0], 2: [0], 3: [1], 4: [1], 5: [1], 6: [2, 3, 4], 7: [5, 6], 8: [7] };
    setConfig(current => ({ ...current, labs: current.labs.map((lab, i, labs) => ({ ...lab, prerequisites: kind === 'branching' ? branch[lab.id] : i ? [labs[i - 1].id] : [] })) }));
    setDirty(true); setImpact(null);
  }
  async function publish(dryRun) {
    setBusy(true); setNotice({}); setErrors([]);
    try {
      const result = await request(`/api/classes/${classId}/publish?dry_run=${dryRun}`, { method: 'POST', body: JSON.stringify({ expected_version: config.version }) });
      if (dryRun) setImpact(result);
      else {
        const autoSet = new Set(result.auto_publish_banks || []);
        setImpact(null);
        setNotice({
          message: autoSet.size > 0
            ? `Đã xuất bản cấu hình cho ${result.affected_students} sinh viên (kèm ${autoSet.size} ngân hàng câu hỏi).`
            : `Đã xuất bản cấu hình cho ${result.affected_students} sinh viên.`,
        });
        setConfig(current => ({
          ...current,
          status: 'published',
          labs: current.labs.map(lab => ({
            ...lab,
            lessons: lab.lessons.map(item => (
              autoSet.has(item.id)
                ? {
                    ...item,
                    content: {
                      ...item.content,
                      bank_ready: true,
                      bank_status: 'published',
                      bank_auto_publishable: false,
                    },
                  }
                : item
            )),
          })),
        }));
        if (autoSet.size > 0) setBankRefreshKey(value => value + 1);
      }
    } catch (failure) { setNotice({ error: failure.message }); setErrors(failure.details?.errors || []); setImpact(null); }
    finally { setBusy(false); }
  }
  async function upgradeCourseVersion() {
    const agreed = await askConfirm({
      title: 'Cập nhật lên giáo trình mới nhất?',
      message: 'Hệ thống sẽ tạo phiên bản mới cho lớp trên giáo trình mới nhất. Toàn bộ ngân hàng câu hỏi và tiến độ học của sinh viên được giữ nguyên.',
      confirmLabel: 'Cập nhật ngay',
      tone: 'info',
    });
    if (!agreed) return;
    setBusy(true); setNotice({}); setErrors([]); setImpact(null);
    try {
      const next = await request(`/api/classes/${classId}/upgrade-course-version`, { method: 'POST' });
      setConfig(next);
      setDirty(false);
      setBankRefreshKey(value => value + 1);
      setNotice({
        message: next.upgrade?.upgraded
          ? 'Đã cập nhật lớp lên phiên bản giáo trình mới nhất.'
          : 'Lớp đã dùng phiên bản giáo trình mới nhất.',
      });
    } catch (failure) {
      setNotice({ error: failure.message });
      setErrors(failure.details?.errors || []);
    } finally {
      setBusy(false);
    }
  }
  return <>
    {confirmDialog}
    <div className="curriculum-bar">
      <div className="curriculum-bar-left">
        <h2>Cấu hình chương trình</h2>
        <span className="curriculum-version-pill">
          v{config.version || 0} · {config.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
          {dirty && <em className="curriculum-dirty-dot"> · Chưa lưu</em>}
        </span>
      </div>
      <div className="curriculum-bar-actions">
        <div className="curriculum-path-group" role="group" aria-label="Mẫu lộ trình">
          <span>Lộ trình:</span>
          <button type="button" disabled={busy} onClick={() => applyPath('branching')}>Phân nhánh</button>
          <button type="button" disabled={busy} onClick={() => applyPath('sequential')}>Tuần tự</button>
        </div>
        {dirty ? (
          <span className="curriculum-preview-disabled" title="Lưu nháp trước khi xem thử">Xem thử</span>
        ) : (
          <Link className="curriculum-preview-link" to={`/classes/${classId}/learn?preview=true`}>Xem thử</Link>
        )}
        <button type="button" disabled={busy || (!dirty && config.version > 0)} onClick={save} className="lms-primary">
          {busy ? 'Đang lưu…' : 'Lưu nháp'}
        </button>
        <button type="button" disabled={busy || dirty || config.status !== 'draft' || !config.version} onClick={() => publish(true)}>
          Kiểm tra xuất bản
        </button>
      </div>
    </div>
    {config.course_upgrade_available && (
      <div className="lms-notice" role="status" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <span>Đang dùng giáo trình cũ ({config.course_version_id}).</span>
        <button type="button" className="lms-primary" disabled={busy} onClick={upgradeCourseVersion}>
          Cập nhật giáo trình
        </button>
      </div>
    )}
    <Notice {...notice} />
    {errors.length > 0 && <section className="lms-notice lms-error" role="alert"><h2>Các mục cần sửa</h2><ul>{errors.map((error, i) => <li key={i}>{error.lab_id !== undefined ? `Lab ${error.lab_id}: ` : ''}{error.lesson_id ? `${error.lesson_id}: ` : ''}{error.message}</li>)}</ul><button onClick={onReload}>Tải lại cấu hình</button></section>}
    {impact && <section className="lms-confirm"><p>Cấu hình hợp lệ. <strong>{impact.affected_students} sinh viên</strong> sẽ nhận bản {impact.version}.{impact.auto_publish_banks?.length > 0 && ` Kèm ${impact.auto_publish_banks.length} ngân hàng câu hỏi.`}</p><div className="lms-actions"><button disabled={busy} onClick={() => publish(false)}>Xác nhận xuất bản</button><button disabled={busy} onClick={() => setImpact(null)}>Hủy</button></div></section>}
    {config.labs.map(lab => (
      <LabPanel
        key={lab.id}
        lab={lab}
        allLabs={config.labs}
        classId={classId}
        busy={busy}
        updateLab={updateLab}
        onReload={onReload}
        handleBankChange={handleBankChange}
        bankRefreshKey={bankRefreshKey}
      />
    ))}
  </>;
}

export default function ClassCurriculumPage() {
  const { classId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/curriculum?draft=true`);
  if (loading) return <p role="status">Đang tải cấu hình chương trình…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  return <Editor key={`${classId}:${data.version}`} initial={data} classId={classId} onReload={reload} />;
}

