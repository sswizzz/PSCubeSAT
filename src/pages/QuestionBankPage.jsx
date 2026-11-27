import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { useConfirm } from '../components/classes/use-confirm';
import '../components/classes/quiz.css';

const labels = { draft: 'Nháp', approved: 'Đã duyệt', retired: 'Đã thu hồi', published: 'Đã xuất bản', queued: 'Chờ xử lý', running: 'Đang tạo', succeeded: 'Đã tạo nháp', failed: 'Thất bại' };
const QUESTION_TYPE_LABELS = {
  single_choice: 'Phần I — 1 đáp án đúng',
  multiple_choice: 'Phần II — Nhiều đáp án đúng',
  true_false: 'Phần III — Đúng / Sai (a, b, c, d)',
  short_answer: 'Phần IV — Trả lời ngắn',
};

// Lab Test banks live under /labs/:labId; per-lesson quiz banks under /lessons/:lessonId.
const bankBase = (classId, labId, lessonId) => lessonId
  ? `/api/classes/${classId}/lessons/${encodeURIComponent(lessonId)}`
  : `/api/classes/${classId}/labs/${labId}`;
const bankNeed = bank => bank.required_questions || 1;
const bankReady = bank => bank.approved_count >= bankNeed(bank);
const bankTitle = (bank, labId) => (bank.kind === 'quiz' ? `Câu hỏi ${bank.lesson_id}` : `Ngân hàng Lab ${labId}`);
const bankPage = (classId, labId, lessonId) => `/classes/${classId}/${lessonId ? `lessons/${encodeURIComponent(lessonId)}` : `labs/${labId}`}/questions`;

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

async function readImportFile(targetFile) {
  const lower = targetFile.name.toLowerCase();
  const format = lower.endsWith('.docx')
    ? 'docx'
    : lower.endsWith('.xlsx')
    ? 'xlsx'
    : lower.endsWith('.csv')
    ? 'csv'
    : lower.endsWith('.txt') || lower.endsWith('.md')
    ? 'text'
    : 'json';
  const binary = format === 'xlsx' || format === 'docx';
  const content = binary ? toBase64(await targetFile.arrayBuffer()) : await targetFile.text();
  return { format, content };
}

function defaultChoices(type = 'single_choice') {
  if (type === 'short_answer') {
    return ['a', 'b', 'c', 'd'].map(id => ({ id, text: `Trả lời ngắn (${id})` }));
  }
  return ['a', 'b', 'c', 'd'].map(id => ({ id, text: '' }));
}

function emptyQuestion(type = 'single_choice') {
  return {
    question_type: type,
    prompt: '',
    choices: defaultChoices(type),
    correct_choice_id: type === 'true_false' ? 'a:Đ|b:S|c:S|d:Đ' : '',
    explanation: '',
    choice_explanations: {},
    objective: 'Kiểm tra kiến thức Lab',
    difficulty: 'medium',
    source_reference: 'Tài liệu Lab',
  };
}

function editableQuestion(q) {
  if (!q) return emptyQuestion();
  const question_type = q.question_type || 'single_choice';
  const { prompt, choices, correct_choice_id, explanation, objective, difficulty, source_reference } = q;
  return {
    question_type,
    prompt,
    choices: choices?.length === 4 ? choices : defaultChoices(question_type),
    correct_choice_id,
    explanation,
    choice_explanations: q.choice_explanations || {},
    objective,
    difficulty,
    source_reference,
  };
}

function parseMultiSelected(raw) {
  return new Set(
    String(raw || '')
      .split(/[|,;\s]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseTrueFalseMap(raw, choices) {
  const ids = (choices || []).map(c => c.id);
  const text = String(raw || '').trim();
  const map = { a: 'Đ', b: 'S', c: 'S', d: 'Đ' };
  const compact = text.replace(/[\s,;|-]+/g, '').toUpperCase();
  if (compact.length === 4 && /^[ĐDSTF10]+$/.test(compact)) {
    ids.forEach((id, idx) => {
      map[id] = 'ĐDT1'.includes(compact[idx]) ? 'Đ' : 'S';
    });
    return map;
  }
  text.split(/[|,;]/).forEach(part => {
    const [k, v] = part.split(/[:=]/).map(s => s?.trim());
    if (k && v) {
      map[k.toLowerCase()] = ['Đ', 'D', 'T', 'TRUE', '1'].includes(v.toUpperCase()) ? 'Đ' : 'S';
    }
  });
  return map;
}

export function BankEditor({ initial, classId, labId, lessonId = null, reload, inline = false, onBankChange = null }) {
  const [bank, setBank] = useState(initial);
  const [selected, setSelected] = useState(initial.questions[0]?.id || null);
  const [question, setQuestion] = useState(() => initial.questions[0] ? editableQuestion(initial.questions[0]) : emptyQuestion());
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [retire, setRetire] = useState('');
  const [questionFile, setQuestionFile] = useState(null);
  const guard = useRef(false);
  const { ask: askConfirm, dialog: confirmDialog } = useConfirm();
  const base = bankBase(classId, labId, lessonId);
  const url = base + '/question-bank';
  const labNo = bank.lab_id ?? labId;
  const draft = bank.status === 'draft';
  const edited = selected && JSON.stringify(question) !== JSON.stringify(editableQuestion(bank.questions.find(q => q.id === selected)));
  const field = key => ({ value: question[key], onChange: event => setQuestion(current => ({ ...current, [key]: event.target.value })) });
  // One short, dimmed explanation box under each choice; stored by choice id like before.
  const choiceNote = (choice, letter) => <textarea className="bank-choice-note" rows={1} maxLength={5000}
    aria-label={`Giải thích phương án ${letter}`}
    placeholder={`Giải thích phương án ${letter}: vì sao đúng hoặc sai (không bắt buộc)`}
    value={question.choice_explanations?.[choice.id] || ''}
    onChange={event => setQuestion(current => ({ ...current, choice_explanations: { ...current.choice_explanations, [choice.id]: event.target.value } }))} />;

  function updateBankState(result) {
    setBank(result);
    if (onBankChange) onBankChange(result);
  }

  async function mutate(path, body, method = 'POST') {
    if (guard.current) return null;
    guard.current = true; setBusy(true); setNotice({});
    try {
      const result = await request(path, { method, body: JSON.stringify(body) });
      if (result.questions) updateBankState(result);
      setNotice({ message: result.affected_attempts !== undefined ? `Đã tạo bản sửa. Có ${result.affected_attempts} lượt thi dùng câu bị thu hồi; lịch sử được giữ nguyên.` : 'Đã lưu thay đổi.' });
      return result;
    } catch (error) { setNotice({ error: error.message }); return null; }
    finally { guard.current = false; setBusy(false); }
  }

  function select(q) {
    setSelected(q?.id || null);
    setQuestion(q ? editableQuestion(q) : emptyQuestion(question.question_type || 'single_choice'));
  }

  function changeQuestionType(nextType) {
    setQuestion(current => {
      const nextChoices = nextType === 'short_answer'
        ? defaultChoices('short_answer')
        : current.question_type === 'short_answer'
        ? defaultChoices(nextType)
        : current.choices;
      const nextAnswer = nextType === 'true_false'
        ? 'a:Đ|b:S|c:S|d:Đ'
        : nextType === 'single_choice'
        ? 'a'
        : nextType === 'multiple_choice'
        ? 'a|b'
        : '';
      return { ...current, question_type: nextType, choices: nextChoices, correct_choice_id: nextAnswer };
    });
  }

  async function save(event) {
    event.preventDefault();
    const payloadQuestion = question.question_type === 'short_answer'
      ? { ...question, choices: defaultChoices('short_answer') }
      : question;
    const result = await mutate(url + '/questions' + (selected ? `/${selected}` : ''), { expected_revision: bank.revision, question: payloadQuestion }, selected ? 'PUT' : 'POST');
    if (result) select(null);
  }

  async function removeQuestion(q, index) {
    const preview = String(q.prompt || '').trim();
    const agreed = await askConfirm({
      title: `Xóa câu ${index + 1}?`,
      message: `${preview ? `“${preview.length > 90 ? `${preview.slice(0, 90)}…` : preview}” ` : 'Câu hỏi này '}sẽ bị xóa khỏi ngân hàng. Hành động này không thể hoàn tác.`,
      confirmLabel: 'Xóa câu hỏi',
      tone: 'danger',
    });
    if (!agreed) return;
    const result = await mutate(`${url}/questions/${q.id}`, { expected_revision: bank.revision }, 'DELETE');
    if (result && selected === q.id) select(null);
  }

  async function review(status) {
    if (edited) { setNotice({ error: 'Lưu nội dung đang sửa trước khi duyệt.' }); return; }
    const result = await mutate(`${url}/questions/${selected}/review`, { expected_revision: bank.revision, status });
    if (result) select(null);
  }

  async function approveAllDrafts() {
    const drafts = bank.questions.filter(q => q.status === 'draft');
    if (!drafts.length) return;
    setBusy(true); setNotice({});
    let currentBank = bank;
    try {
      for (const item of drafts) {
        currentBank = await request(`${url}/questions/${item.id}/review`, {
          method: 'POST',
          body: JSON.stringify({ expected_revision: currentBank.revision, status: 'approved' }),
        });
      }
      updateBankState(currentBank);
      setNotice({ message: `Đã duyệt ${drafts.length} câu hỏi nháp.` });
    } catch (error) {
      setNotice({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples() {
    const result = await mutate(url + '/load-samples', { expected_revision: bank.revision });
    if (result) {
      setNotice({
        message: result.added_count > 0
          ? `Đã nạp ${result.added_count} câu hỏi mẫu đã duyệt vào ngân hàng.`
          : 'Các câu hỏi mẫu đã có sẵn trong ngân hàng.',
      });
    }
  }

  async function importFile(event) {
    event.preventDefault();
    if (!questionFile || questionFile.size > 1000000) {
      setNotice({ error: 'Chọn file câu hỏi tối đa 1 MB (.csv hoặc .xlsx).' });
      return;
    }
    const qPayload = await readImportFile(questionFile);
    const body = {
      expected_revision: bank.revision,
      format: qPayload.format,
      content: qPayload.content,
    };
    const result = await mutate(url + '/import', body);
    if (result) {
      setQuestionFile(null);
    }
  }

  const multiSet = parseMultiSelected(question.correct_choice_id);
  const tfMap = parseTrueFalseMap(question.correct_choice_id, question.choices);

  return <div className={inline ? 'lms-inline-bank' : ''}>
    {confirmDialog}
    {!inline && <>
      <header className="lms-heading"><div><h1>{bankTitle(bank, labId)}</h1><p>Phiên bản {bank.version} · {labels[bank.status]} · {bank.approved_count} câu đã duyệt</p></div><Link to={`/classes/${classId}/curriculum`}>Cấu hình chương trình</Link></header>
      {!lessonId && <nav className="lms-actions" aria-label="Ngân hàng theo lab">{Array.from({ length: 9 }, (_, id) => <Link key={id} aria-current={id === Number(labId) ? 'page' : undefined} to={`/classes/${classId}/labs/${id}/questions`}>Lab {id}</Link>)}</nav>}
    </>}
    {inline && <div className="lms-heading" style={{ margin: '12px 0' }}>
      <div>
        <strong>{bank.kind === 'quiz' ? bankTitle(bank, labId) : `Ngân hàng câu hỏi Lab ${labId}`}</strong>
        <span className="lms-secondary">Phiên bản {bank.version} · {labels[bank.status]} · <strong>{bank.approved_count}</strong> câu đã duyệt (tổng {bank.questions.length} câu)</span>
      </div>
      <Link to={bankPage(classId, labId, lessonId)}>Mở trang ngân hàng đầy đủ</Link>
    </div>}
    <Notice {...notice} />
    <div className="lms-actions">
      <button type="button" disabled={busy} onClick={reload}>Tải lại ngân hàng</button>
      {draft && (
        <button type="button" disabled={busy} onClick={loadSamples}>
          Nạp câu hỏi mẫu
        </button>
      )}
      {draft && bank.questions.some(q => q.status === 'draft') && (
        <button type="button" disabled={busy} onClick={approveAllDrafts}>
          Duyệt tất cả câu nháp ({bank.questions.filter(q => q.status === 'draft').length})
        </button>
      )}
      {draft && (
        <button type="button" className="lms-primary" disabled={busy || !bankReady(bank)} onClick={() => mutate(url + '/publish', { expected_revision: bank.revision })}>
          Xuất bản {bank.approved_count} câu đã duyệt
        </button>
      )}
    </div>
    <p>Mỗi lượt làm bài rút ngẫu nhiên số câu theo cấu hình (mặc định 5 câu cho Quiz, 20 câu cho Lab Test; nếu ngân hàng ít hơn thì lấy hết), cần ít nhất 1 câu đã duyệt. Hỗ trợ 4 dạng câu hỏi theo đề mẫu (1 đáp án, nhiều đáp án, Đúng/Sai 4 ý a-b-c-d, trả lời ngắn).</p>
    {!draft && <form className="lms-panel" onSubmit={async event => { event.preventDefault(); const result = await mutate(url + '/fork', { expected_revision: bank.revision, reason, retire_question_id: retire || null }); if (result) select(null); }}>
      <h2>Tạo phiên bản sửa</h2><p>Lượt đang làm và kết quả cũ giữ nguyên. Thu hồi câu sẽ tạm ngừng cấp đề mới cho đến khi xuất bản bản sửa.</p>
      <div className="lms-form-grid"><label>Câu cần thu hồi (nếu có)<select value={retire} onChange={event => setRetire(event.target.value)}><option value="">Chỉ tạo phiên bản mới</option>{bank.questions.map(q => <option key={q.id} value={q.question_id}>{q.prompt.slice(0, 100)}</option>)}</select></label><label>Lý do<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></div><button disabled={busy}>Tạo bản sửa</button>
    </form>}
    <div className="bank-workspace">
      <aside>
        <h2>Câu hỏi ({bank.questions.length})</h2>
        {draft && <button type="button" disabled={busy} onClick={() => select(null)}>+ Thêm câu hỏi mới</button>}
        <div className="bank-list">
          {bank.questions.map((q, index) => (
            <div className="bank-row" key={q.id}>
              <button type="button" aria-current={selected === q.id ? 'true' : undefined} onClick={() => select(q)}>
                <small>Câu {index + 1} · {QUESTION_TYPE_LABELS[q.question_type || 'single_choice']} · {labels[q.status]}</small>
                <span className="bank-prompt">{q.prompt}</span>
              </button>
              {draft && <button type="button" className="bank-delete" disabled={busy} title="Xóa câu hỏi" aria-label={`Xóa câu ${index + 1}`} onClick={() => removeQuestion(q, index)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></svg>
              </button>}
            </div>
          ))}
        </div>
        {!bank.questions.length && <p>Ngân hàng trống. Thêm câu hỏi trực tiếp bên phải hoặc nhập từ tệp đề mẫu bên dưới.</p>}
      </aside>
      <form onSubmit={save} className="bank-editor">
        <h2>{selected ? 'Chỉnh sửa câu hỏi & đáp án' : 'Thêm câu hỏi & đáp án mới'}</h2>
        <fieldset disabled={busy || !draft} className="bank-fields">
          <label>
            Dạng câu hỏi
            <select value={question.question_type || 'single_choice'} onChange={event => changeQuestionType(event.target.value)}>
              <option value="single_choice">Phần I — Trắc nghiệm 1 đáp án đúng (A, B, C, D)</option>
              <option value="multiple_choice">Phần II — Trắc nghiệm nhiều đáp án đúng (A|B|D)</option>
              <option value="true_false">Phần III — Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)</option>
              <option value="short_answer">Phần IV — Trắc nghiệm trả lời ngắn (điền kết quả)</option>
            </select>
          </label>
          <label>Nội dung câu hỏi (Prompt)<textarea {...field('prompt')} required minLength={10} maxLength={5000} rows={3} placeholder="VD: Câu 1. Mệnh đề toán học nào sau đây là mệnh đề sai?" /></label>

          {(!question.question_type || question.question_type === 'single_choice') && <>
            <p className="bank-group-title">Chọn 1 đáp án đúng <small>(A, B, C hoặc D)</small></p>
            {question.choices.map((choice, index) => {
              const letter = String.fromCharCode(65 + index);
              return <div className="bank-choice" key={choice.id}>
                <input type="radio" name={`correct-${labId}`} aria-label={`Đáp án đúng là lựa chọn ${letter}`} required checked={question.correct_choice_id === choice.id} onChange={() => setQuestion(current => ({ ...current, correct_choice_id: choice.id }))} />
                <label>Phương án {letter}<input required maxLength={2000} value={choice.text} placeholder={`Nội dung phương án ${letter}`} onChange={event => setQuestion(current => ({ ...current, choices: current.choices.map(c => c.id === choice.id ? { ...c, text: event.target.value } : c) }))} /></label>
                {choiceNote(choice, letter)}
              </div>;
            })}
          </>}

          {question.question_type === 'multiple_choice' && <>
            <p className="bank-group-title">Chọn các phương án đúng <small>Hiện tại: <code>{(question.correct_choice_id || '').toUpperCase() || 'Chưa chọn'}</code></small></p>
            {question.choices.map((choice, index) => {
              const letter = String.fromCharCode(65 + index);
              const checked = multiSet.has(choice.id.toLowerCase());
              return <div className="bank-choice" key={choice.id}>
                <input
                  type="checkbox"
                  aria-label={`Phương án đúng ${letter}`}
                  checked={checked}
                  onChange={event => {
                    const next = new Set(multiSet);
                    if (event.target.checked) next.add(choice.id.toLowerCase());
                    else next.delete(choice.id.toLowerCase());
                    const joined = ['a', 'b', 'c', 'd'].filter(id => next.has(id)).join('|');
                    setQuestion(current => ({ ...current, correct_choice_id: joined }));
                  }}
                />
                <label>Phương án {letter}<input required maxLength={2000} value={choice.text} placeholder={`Nội dung phương án ${letter}`} onChange={event => setQuestion(current => ({ ...current, choices: current.choices.map(c => c.id === choice.id ? { ...c, text: event.target.value } : c) }))} /></label>
                {choiceNote(choice, letter)}
              </div>;
            })}
          </>}

          {question.question_type === 'true_false' && <>
            <p className="bank-group-title">
              Nhập 4 mệnh đề <code>a)</code>, <code>b)</code>, <code>c)</code>, <code>d)</code> và chọn <strong>Đúng (Đ)</strong> hoặc <strong>Sai (S)</strong> cho từng mệnh đề.
              <span className="lms-secondary">Mẹo: Có thể thêm tiền tố <code>[0, TH]</code>, <code>[1, NB]</code>, <code>[2, VD]</code> ở đầu mệnh đề để điều khiển thứ tự đảo (số 0 ở bất kỳ vị trí nào; cùng số đứng gần nhau; số nhỏ đứng trước số lớn).</span>
            </p>
            {question.choices.map((choice, index) => {
              const letter = String.fromCharCode(97 + index);
              const currentVal = tfMap[choice.id] || 'Đ';
              return <div className="bank-choice bank-choice-tf" key={choice.id}>
                <select
                  aria-label={`Đúng/Sai cho ý ${letter}`}
                  value={currentVal}
                  onChange={event => {
                    const nextMap = { ...tfMap, [choice.id]: event.target.value };
                    const encoded = ['a', 'b', 'c', 'd'].map(id => `${id}:${nextMap[id] || 'S'}`).join('|');
                    setQuestion(current => ({ ...current, correct_choice_id: encoded }));
                  }}
                >
                  <option value="Đ">Đúng (Đ)</option>
                  <option value="S">Sai (S)</option>
                </select>
                <label>Ý {letter})<input required maxLength={2000} value={choice.text} placeholder={`VD: [1, NB] Nội dung mệnh đề ${letter}...`} onChange={event => setQuestion(current => ({ ...current, choices: current.choices.map(c => c.id === choice.id ? { ...c, text: event.target.value } : c) }))} /></label>
                {choiceNote(choice, letter)}
              </div>;
            })}
          </>}

          {question.question_type === 'short_answer' && (
            <label>
              Đáp án trả lời ngắn (Số hoặc chuỗi ngắn, tối đa 64 ký tự)
              <input
                required
                maxLength={64}
                value={question.correct_choice_id}
                placeholder="VD: 10 hoặc -1.5 hoặc 31"
                onChange={event => setQuestion(current => ({ ...current, correct_choice_id: event.target.value }))}
              />
            </label>
          )}

          <label>Lời giải chung<textarea {...field('explanation')} required minLength={5} maxLength={5000} rows={2} placeholder="Tóm tắt cách giải..." /></label>
          <div className="lms-form-grid">
            <label>Mục tiêu kiến thức<input {...field('objective')} required minLength={3} maxLength={500} /></label>
            <label>Độ khó<select {...field('difficulty')}><option value="easy">Nhận biết (Dễ)</option><option value="medium">Thông hiểu (Trung bình)</option><option value="hard">Vận dụng (Khó)</option></select></label>
            <label className="lms-wide">Tham chiếu nguồn<input {...field('source_reference')} required minLength={3} maxLength={2000} placeholder="Tên tài liệu, mục hoặc trang" /></label>
          </div>
        </fieldset>
        {draft && <div className="lms-actions">
          <button className="lms-primary" disabled={busy}>{selected ? 'Cập nhật câu hỏi' : 'Thêm câu hỏi vào ngân hàng'}</button>
          {selected && <>
            <button type="button" disabled={busy} onClick={() => review('approved')}>Duyệt câu này</button>
            <button type="button" disabled={busy} onClick={() => review('retired')}>Thu hồi</button>
            <button type="button" disabled={busy} onClick={async () => { const result = await mutate(`${url}/questions/${selected}`, { expected_revision: bank.revision }, 'DELETE'); if (result) select(null); }}>Xóa câu nháp</button>
          </>}
        </div>}
        {selected && <small>Nút duyệt áp dụng cho nội dung đã lưu. Lưu các thay đổi trước khi duyệt.</small>}
      </form>
    </div>

    {draft && <section className="lms-panel">
      <h2>Nhập từ file câu hỏi (đã gồm đáp án và giải thích)</h2>
      <p className="lms-import-head">
        <strong>Mẫu file (đã gồm đáp án đúng và giải thích từng đáp án):</strong>{' '}
        <a href="/templates/question-bank.csv" download>File câu hỏi mẫu (.csv)</a>
        {' · '}
        <a href="/templates/question-bank.xlsx" download>File câu hỏi mẫu (.xlsx)</a>
        
      </p>
      <form className="lms-filters" onSubmit={importFile}>
        <label>
          File câu hỏi gộp đáp án và giải thích (.csv hoặc .xlsx)
          <input type="file" accept=".xlsx,.csv" onChange={event => setQuestionFile(event.target.files?.[0] || null)} required />
        </label>
        <button className="lms-primary" disabled={busy || !questionFile}>Kiểm tra và nhập câu hỏi</button>
      </form>
    </section>}
    {!inline && <>
      <PolicyForm key={bank.policy.revision} initial={bank.policy} busy={busy} onSave={value => mutate(base + '/quiz-policy', value, 'PUT')} />
      {bank.ai_available && draft && <GenerationForm classId={classId} labId={labNo} revision={bank.revision} url={url} busy={busy} mutate={mutate} onReload={reload} />}
      <TeacherResults base={base} />
    </>}
  </div>;
}

function PolicyForm({ initial, busy, onSave }) {
  const [value, setValue] = useState({ cooldown_minutes: 0, ...initial });
  const [close, setClose] = useState(initial.closes_at ? new Date(Date.parse(initial.closes_at) - new Date(initial.closes_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
  const isUnlimited = value.max_attempts === null;
  return <details className="lms-panel"><summary><h2>Chính sách bài test</h2></summary><p>Áp dụng cho lượt mới. Tham số riêng trong cấu hình chương trình đã xuất bản được ưu tiên. Các lượt đang thi giữ chính sách ban đầu.</p>
    <form onSubmit={event => { event.preventDefault(); const { revision, ...fields } = value; onSave({ ...fields, cooldown_minutes: isUnlimited ? 0 : Number(fields.cooldown_minutes || 0), expected_revision: revision, closes_at: close ? new Date(close).toISOString() : null }); }}><div className="lms-form-grid">
      {[['num_questions', 'Số câu rút mỗi lượt', 200], ['time_limit_minutes', 'Thời gian (phút)', 180], ['pass_score', 'Số câu đúng tối thiểu để đạt', 200]].map(([key, label, max]) => <label key={key}>{label}<input type="number" min={1} max={max} required value={value[key] ?? ''} onChange={event => setValue(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--cubesat-ink)' }}>Số lượt làm mỗi đợt</span>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={isUnlimited}
            onChange={event => setValue(current => ({
              ...current,
              max_attempts: event.target.checked ? null : 5,
              cooldown_minutes: event.target.checked ? 0 : (current.cooldown_minutes ?? 30),
            }))}
          />
          <span>Không giới hạn lượt</span>
        </label>
        {!isUnlimited && (
          <input
            type="number"
            aria-label="Số lượt làm mỗi đợt"
            min={1}
            max={100}
            required
            value={value.max_attempts ?? 5}
            onChange={event => setValue(current => ({ ...current, max_attempts: Number(event.target.value) }))}
          />
        )}
      </div>
      <label>
        Thời gian chờ khi hết lượt (phút)
        <input
          type="number"
          min={0}
          max={1440}
          required
          disabled={isUnlimited}
          value={isUnlimited ? 0 : (value.cooldown_minutes ?? 0)}
          onChange={event => setValue(current => ({ ...current, cooldown_minutes: Number(event.target.value) }))}
        />
        <small className="lms-secondary">0 = khóa hẳn khi hết lượt; &gt; 0 = mở đợt mới sau thời gian chờ.</small>
      </label>
      <label>Công bố đáp án<select value={value.reveal_policy} onChange={event => setValue(current => ({ ...current, reveal_policy: event.target.value }))}><option value="after_pass">Khi đạt điểm tối thiểu (hoặc khóa hẳn khi hết lượt)</option><option value="after_attempts">Sau khi hết lượt (nếu không có thời gian chờ)</option><option value="after_close">Sau khi đóng bài test</option><option value="immediate">Ngay sau nộp (không thi lại sau khi xem)</option><option value="never">Không công bố</option></select></label>
      <label>Đóng bài test (giờ địa phương)<input type="datetime-local" value={close} required={value.reveal_policy === 'after_close'} onChange={event => setClose(event.target.value)} /></label>
    </div><button disabled={busy}>Lưu chính sách</button></form></details>;
}

function GenerationForm({ classId, labId, revision, url, busy, mutate, onReload }) {
  const config = useLmsResource(`/api/classes/${classId}/curriculum?draft=true`);
  const jobs = useLmsResource(url + '/generation-jobs');
  const [selected, setSelected] = useState([]);
  const [count, setCount] = useState(5);
  const docs = config.data?.labs.find(lab => lab.id === Number(labId))?.lessons.filter(q => q.type === 'document' && q.content.markdown) || [];
  return <section className="lms-panel"><h2>Tạo câu nháp từ tài liệu</h2><p>Chỉ gửi tài liệu đã chọn. Mỗi lần thử lại được tính vào hạn mức; giảng viên phải kiểm tra và duyệt nội dung.</p><Notice error={config.error || jobs.error} />
    <form onSubmit={async event => { event.preventDefault(); await mutate(url + '/generation-jobs', { expected_revision: revision, lesson_ids: selected, count }); jobs.reload(); }}><div className="bank-source-list">{docs.map(doc => <label key={doc.id}><input type="checkbox" checked={selected.includes(doc.id)} onChange={event => setSelected(current => event.target.checked ? [...current, doc.id] : current.filter(id => id !== doc.id))} />{doc.title}</label>)}</div><label>Số câu nháp<input type="number" min={1} max={20} value={count} onChange={event => setCount(Number(event.target.value))} /></label><button disabled={busy || !selected.length}>Tạo câu nháp</button></form>
    <button onClick={() => { jobs.reload(); onReload(); }}>Cập nhật job và ngân hàng</button>
    {jobs.data?.map(job => <div key={job.id}><p>{labels[job.status]} · {job.count} câu · {job.tries}/3 lần gọi · Đã giữ hạn mức ${job.reserved_usd.toFixed(4)}</p>{job.error && <p>{job.error}</p>}{job.status === 'failed' && job.tries < 3 && <button disabled={busy} onClick={async () => { await mutate(`${url}/generation-jobs/${job.id}/retry`, {}); jobs.reload(); }}>Thử lại</button>}</div>)}
  </section>;
}

function TeacherResults({ base }) {
  const stats = useLmsResource(base + '/quiz-statistics');
  const [page, setPage] = useState(1);
  const members = useLmsResource(base.replace(/\/(?:labs\/\d+|lessons\/[^/]+)$/, '') + `/members?status=active&page=${page}&page_size=20`);
  const [member, setMember] = useState('');
  const [extra, setExtra] = useState(1);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  async function grant(event) {
    event.preventDefault(); if (busy) return; setBusy(true);
    const fields = { membership_id: Number(member), extra_attempts: extra, reason };
    if (!pending.current || JSON.stringify(pending.current.fields) !== JSON.stringify(fields)) pending.current = { fields, key: crypto.randomUUID() };
    try { await request(base + '/attempt-grants', { method: 'POST', body: JSON.stringify({ ...fields, idempotency_key: pending.current.key }) }); pending.current = null; setNotice({ message: 'Đã cấp thêm lượt và lưu lý do.' }); }
    catch (error) { setNotice({ error: error.message }); }
    finally { setBusy(false); }
  }
  return <><section className="lms-panel"><h2>Cấp thêm lượt thi</h2><Notice {...notice} /><Notice error={members.error} /><form onSubmit={grant}><div className="lms-form-grid"><label>Sinh viên<select required value={member} onChange={event => setMember(event.target.value)}><option value="">Chọn sinh viên</option>{members.data?.items?.filter(m => m.status === 'active' && m.role === 'student').map(m => <option key={m.id} value={m.id}>{m.display_name || m.email}</option>)}</select></label><label>Số lượt thêm<input type="number" min={1} max={20} value={extra} onChange={event => setExtra(Number(event.target.value))} /></label><label>Lý do<textarea required minLength={5} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></div><button disabled={busy}>Cấp lượt</button></form></section>
    <div className="lms-actions"><button disabled={page <= 1} onClick={() => { setPage(page - 1); setMember(''); }}>Nhóm sinh viên trước</button><button disabled={page * 20 >= (members.data?.total || 0)} onClick={() => { setPage(page + 1); setMember(''); }}>Nhóm sinh viên tiếp</button></div>
    <section className="lms-panel"><h2>Tỷ lệ đúng theo phiên bản câu</h2><button onClick={stats.reload}>Cập nhật thống kê</button><Notice error={stats.error} />{!stats.data?.length ? <p>Chưa có lượt đã chấm.</p> : <div className="lms-table-wrap"><table><caption className="sr-only">Tỷ lệ trả lời đúng theo từng phiên bản câu hỏi</caption><thead><tr><th>Câu hỏi</th><th>Lượt đúng / Tổng</th><th>Tỷ lệ đúng</th></tr></thead><tbody>{stats.data.map(row => <tr key={row.question_version_id}><td>{row.prompt}<small> {row.question_version_id.slice(0, 8)}</small></td><td>{row.correct}/{row.total}</td><td>{Math.round(row.correct_ratio * 100)}%</td></tr>)}</tbody></table></div>}</section></>;
}

export function InlineQuestionBank({
  classId,
  labId,
  lessonId = null,
  onPublished = null,
  onBankChange = null,
  refreshKey = 0,
}) {
  const url = bankBase(classId, labId, lessonId) + '/question-bank';
  const { data: bank, loading, error, reload } = useLmsResource(url);
  const [questionFile, setQuestionFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const onBankChangeRef = useRef(onBankChange);
  onBankChangeRef.current = onBankChange;
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    if (bank && onBankChangeRef.current) {
      onBankChangeRef.current(lessonId || `labtest-${labId}`, bank);
    }
  }, [bank, labId, lessonId]);

  useEffect(() => {
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      reload();
    }
  }, [refreshKey, reload]);

  if (loading) return <p role="status">Đang tải ngân hàng câu hỏi {lessonId ? lessonId : `Lab ${labId}`}…</p>;
  if (error) return <><Notice error={error} /><button type="button" onClick={reload}>Thử lại</button></>;

  const draft = bank.status === 'draft';
  const draftCount = bank.questions.filter(q => q.status === 'draft').length;

  async function loadSamples() {
    setBusy(true);
    setNotice({});
    try {
      const result = await request(url + '/load-samples', {
        method: 'POST',
        body: JSON.stringify({ expected_revision: bank.revision }),
      });
      setNotice({
        message: result.added_count > 0
          ? `Đã nạp ${result.added_count} câu hỏi mẫu đã duyệt vào ngân hàng.`
          : 'Các câu hỏi mẫu đã có sẵn trong ngân hàng.',
      });
      reload();
    } catch (err) {
      setNotice({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(event) {
    event.preventDefault();
    if (!questionFile || questionFile.size > 1000000) {
      setNotice({ error: 'Chọn file câu hỏi tối đa 1 MB (.csv hoặc .xlsx).' });
      return;
    }
    setBusy(true);
    setNotice({});
    try {
      const qPayload = await readImportFile(questionFile);
      const body = {
        expected_revision: bank.revision,
        format: qPayload.format,
        content: qPayload.content,
      };
      await request(url + '/import', { method: 'POST', body: JSON.stringify(body) });
      setQuestionFile(null);
      setNotice({ message: 'Đã thêm câu hỏi từ file vào ngân hàng.' });
      reload();
    } catch (err) {
      setNotice({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    const drafts = bank.questions.filter(q => q.status === 'draft');
    if (!drafts.length) return;
    setBusy(true);
    setNotice({});
    let rev = bank.revision;
    try {
      for (const item of drafts) {
        const updated = await request(`${url}/questions/${item.id}/review`, {
          method: 'POST',
          body: JSON.stringify({ expected_revision: rev, status: 'approved' }),
        });
        rev = updated.revision;
      }
      setNotice({ message: `Đã duyệt ${drafts.length} câu hỏi nháp.` });
      reload();
    } catch (err) {
      setNotice({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function publishBank() {
    setBusy(true);
    setNotice({});
    try {
      await request(url + '/publish', {
        method: 'POST',
        body: JSON.stringify({ expected_revision: bank.revision }),
      });
      setNotice({ message: 'Đã xuất bản ngân hàng câu hỏi.' });
      reload();
      if (onPublished) onPublished();
    } catch (err) {
      setNotice({ error: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lms-inline-bank">
      <div className="lms-actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>Thêm file câu hỏi & đáp án ({lessonId ? lessonId : `Lab Test ${labId}`})</strong>
          <span className="lms-secondary">
            Phiên bản {bank.version} · {labels[bank.status]} · Đã duyệt <strong>{bank.approved_count}</strong> câu (tổng {bank.questions.length} câu)
            {draft && bank.approved_count > 0 && draftCount === 0 && ' · Sẵn sàng tự xuất bản cùng cấu hình lớp'}
          </span>
          <span className="lms-secondary">
            <strong>Mẫu file (đã gồm đáp án đúng và giải thích từng đáp án):</strong>{' '}
            <a href="/templates/question-bank.csv" download>File câu hỏi (.csv)</a> ·{' '}
            <a href="/templates/question-bank.xlsx" download>File câu hỏi (.xlsx)</a>
            
          </span>
        </div>
        <div className="lms-actions">
          <Link to={bankPage(classId, labId, lessonId)} className="lms-btn-link">
            Mở trang riêng để soạn câu hỏi
          </Link>
        </div>
      </div>
      <Notice {...notice} />
      {draft ? (
        <>
          <form className="lms-filters" onSubmit={handleImport} style={{ marginTop: '12px' }}>
            <label>
              File câu hỏi gộp đáp án và giải thích (.csv hoặc .xlsx)
              <input type="file" accept=".xlsx,.csv" onChange={event => setQuestionFile(event.target.files?.[0] || null)} required />
            </label>
            <button className="lms-primary" disabled={busy || !questionFile}>Thêm file câu hỏi</button>
          </form>
          <div className="lms-actions" style={{ marginTop: '10px' }}>
            <button type="button" disabled={busy} onClick={loadSamples}>
              Nạp câu hỏi mẫu
            </button>
            {draftCount > 0 && (
              <button type="button" disabled={busy} onClick={approveAll}>
                Duyệt tất cả câu nháp ({draftCount})
              </button>
            )}
            {(draftCount > 0 || bankReady(bank)) && (
              <button
                type="button"
                className="lms-primary"
                disabled={busy || !bankReady(bank)}
                onClick={publishBank}
              >
                Xuất bản {bank.approved_count} câu đã duyệt
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="lms-secondary" style={{ marginTop: '8px' }}>
          Ngân hàng câu hỏi đã xuất bản. Để chỉnh sửa hoặc tạo phiên bản mới, vui lòng bấm <strong>Mở trang riêng để soạn câu hỏi</strong>.
        </p>
      )}
    </div>
  );
}

export default function QuestionBankPage() {
  const { classId, labId, lessonId } = useParams();
  const { data, loading, error, reload } = useLmsResource(bankBase(classId, labId, lessonId) + '/question-bank');
  if (loading) return <p role="status">Đang tải ngân hàng…</p>;
  if (error) return <><Notice error={error} /><Link to={`/classes/${classId}/curriculum`}>Về cấu hình chương trình</Link><button onClick={reload}>Thử lại</button></>;
  return <BankEditor key={`${classId}:${lessonId || labId}:${data.revision}`} initial={data} classId={classId} labId={labId} lessonId={lessonId} reload={reload} />;
}
