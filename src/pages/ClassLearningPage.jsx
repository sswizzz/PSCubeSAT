import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { request, useAuth } from '../contexts/auth-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';
import DocViewer from '../components/common/DocViewer';
import VideoPlayer from '../components/common/VideoPlayer';
import TelemetryControls from '../components/groundstation/TelemetryControls';
import { downloadFile } from '../components/editor/blockly-project';

const QuizPanel = lazy(() => import('../components/classes/QuizPanel'));
const IDEPanel = lazy(() => import('../components/editor/IDEPanel'));
const LabPracticeActions = lazy(() => import('../components/editor/LabPracticeActions'));
const PracticeVisualization = lazy(() => import('../components/visualization/PracticeVisualization'));
const ComponentViewer = lazy(() => import('../components/interactive/ComponentViewer'));
const types = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', labtest: 'Lab test' };

function Practice({ lesson, labId, classId, preview, onRefresh }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const content = lesson.content;
  async function download() {
    try {
      const response = await fetchSource(lesson.id, classId);
      downloadFile(`${lesson.id}.ino`, response, 'text/plain');
    } catch (failure) { setError(failure.message); }
  }
  return <section className="lms-panel"><h2>Thực hành</h2>
    {content.instructions ? <DocViewer content={content.instructions} docPath={undefined} /> : <p>Giảng viên chưa bổ sung hướng dẫn chi tiết cho bài này.</p>}
    {content.evidence && <p><strong>Minh chứng:</strong> {content.evidence}</p>}
    {content.rubric && <><h3>Tiêu chí chấm</h3><DocViewer content={content.rubric} docPath={undefined} /></>}
    {content.mode === 'exploration' ? <Suspense fallback={<p>Đang tải mô hình…</p>}><ComponentViewer /></Suspense> : !preview && <>
      {content.exercise_id && <button onClick={download}>Tải mã mẫu .ino</button>}<Notice error={error} />
      <TelemetryControls />
      <Suspense fallback={<p>Đang tải không gian thực hành…</p>}>
        <IDEPanel labId={labId} exerciseId={lesson.id} storageScope={`user:${user.id}:class:${classId}`} setCode={setCode} showToolbar={false} />
        <div className="lms-actions"><LabPracticeActions code={code} labId={labId} classId={Number(classId)} lessonId={lesson.id} configuredBoard={content.board || ''} /></div>
        <SubmissionPanel classId={classId} lessonId={lesson.id} code={code} rubric={content.rubric} onRefresh={onRefresh} />
        <PracticeVisualization />
      </Suspense>
    </>}
    {preview && content.mode !== 'exploration' && <p>Chế độ xem thử chỉ hiển thị yêu cầu và tiêu chí; không biên dịch hoặc ghi tiến độ.</p>}
  </section>;
}

function SubmissionPanel({ classId, lessonId, code, rubric, onRefresh }) {
  const url = `/api/classes/${classId}/lessons/${encodeURIComponent(lessonId)}/submissions`;
  const { data, error, reload } = useLmsResource(url);
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(null);
  async function submit() {
    setBusy(true); setNotice({});
    if (!pending.current || pending.current.code !== code) pending.current = { code, idempotency_key: crypto.randomUUID() };
    try {
      await request(url, { method: 'POST', body: JSON.stringify(pending.current) });
      pending.current = null; reload(); onRefresh(); setNotice({ message: 'Đã nộp phiên bản mã nguồn. Bài đang chờ giảng viên duyệt.' });
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  return <section className="submission-panel"><h3>Bài nộp của tôi</h3><p>Biên dịch thành công chưa hoàn thành bài. Giảng viên sẽ duyệt theo tiêu chí đã giao.</p>
    <button disabled={busy || !code.trim() || !rubric} onClick={submit}>{busy ? 'Đang nộp…' : 'Nộp phiên bản mã nguồn'}</button>
    {!rubric && <p>Giảng viên cần bổ sung tiêu chí chấm trước khi bạn nộp bài.</p>}<Notice {...notice} /><Notice error={error} />
    {data?.map(item => <details key={item.id}><summary>Phiên bản {item.revision} · {{ pending_review: 'Chờ chấm', approved: 'Đã duyệt', changes_requested: 'Cần sửa' }[item.status]}</summary><p>{item.feedback || 'Chưa có nhận xét.'}</p><pre>{item.code}</pre></details>)}
  </section>;
}

function LessonContent({ lesson, labId, classId, preview, onRefresh }) {
  const [notice, setNotice] = useState({});
  const openedKey = useRef(crypto.randomUUID());
  const queue = useRef(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const event = useCallback(async (kind, values = {}, key = crypto.randomUUID()) => {
    const body = JSON.stringify({ idempotency_key: key, kind, ...values });
    // Retrying the exact key is safe if a response is lost after the server commits.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await request(`/api/classes/${classId}/lessons/${encodeURIComponent(lesson.id)}/events`, { method: 'POST', body }); }
      catch (failure) { if (failure.status || attempt) throw failure; }
    }
  }, [classId, lesson.id]);
  useEffect(() => {
    if (!preview && lesson.type !== 'labtest') event('opened', {}, openedKey.current).catch(failure => setNotice({ error: failure.message }));
  }, [preview, event, lesson.type]);
  async function confirm(kind) {
    setBusy(true); setNotice({});
    try { await event(kind); onRefresh(); setNotice({ message: 'Đã ghi nhận hoàn thành bài học.' }); }
    catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  function segment(start, end, position) {
    if (preview) return;
    queue.current = queue.current.catch(() => {}).then(async () => {
      try {
        const progress = await event('video_segment', { start, end, position });
        if (progress.status === 'completed' && !['completed', 'waived'].includes(lesson.progress?.status)) onRefresh();
      } catch (failure) { setNotice({ error: failure.message }); }
    });
  }
  const completed = ['completed', 'waived'].includes(lesson.progress?.status);
  return <><Notice {...notice} />
    {completed && <p className="lesson-achieved" role="status">✓ {lesson.progress.status === 'waived' ? 'Đã được miễn yêu cầu' : 'Đã hoàn thành'}</p>}
    {lesson.type === 'video' && <><VideoPlayer url={lesson.content.url} initialPosition={lesson.progress?.last_position || 0} onSegment={preview ? undefined : segment} trackingMode={lesson.content.tracking_mode || 'native'} />
      {!preview && lesson.content.confirmation_allowed && <button disabled={busy || completed} onClick={() => confirm('video_confirmed')}>{completed ? 'Đã hoàn thành bài học' : 'Hoàn thành bài học'}</button>}
      {!preview && !lesson.content.confirmation_allowed && !/\.(mp4|webm|ogg|ogv)(?:\?|#|$)/i.test(lesson.content.url) && <p>Nguồn video này chưa hỗ trợ đo đoạn xem. Giảng viên cần bật chế độ xác nhận hoặc cung cấp video đo được.</p>}
    </>}
    {lesson.type === 'document' && <><DocViewer content={lesson.content.markdown || '# Tài liệu đang được cập nhật'} docPath={undefined} />{!preview && <button className="lms-primary" disabled={busy || completed} onClick={() => confirm('document_read')}>{completed ? 'Đã hoàn thành bài học' : 'Hoàn thành bài học'}</button>}</>}
    {lesson.type === 'practice' && <Practice lesson={lesson} labId={labId} classId={classId} preview={preview} onRefresh={onRefresh} />}
    {lesson.type === 'labtest' && (preview ? <p>Chế độ xem thử không tạo lượt thi. Mỗi đề gồm 5 câu từ ngân hàng được duyệt.</p> : <Suspense fallback={<p>Đang tải bài kiểm tra…</p>}><QuizPanel classId={classId} labId={labId} policySummary={lesson.content} onRefresh={onRefresh} /></Suspense>)}
  </>;
}

async function fetchSource(lessonId, classId) {
  const { authorizedFetch } = await import('../contexts/auth-api');
  const response = await authorizedFetch(`/api/curriculum/exercises/${encodeURIComponent(lessonId)}/source?class_id=${classId}`);
  if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Không tải được mã mẫu.'); }
  return response.text();
}

export default function ClassLearningPage({ experience = false }) {
  const { classId } = useParams();
  const [search, setSearch] = useSearchParams();
  const preview = experience || search.get('preview') === 'true';
  const path = experience ? '/api/curriculum/preview' : `/api/classes/${classId}/curriculum${preview ? '?draft=true&student_view=true' : '?student_view=true'}`;
  const { data, loading, error, reload } = useLmsResource(path, true);
  const selected = data?.labs.flatMap(lab => lab.lessons.map(lesson => ({ lab, lesson }))).find(item => item.lesson.id === search.get('lesson'))
    || (data?.labs.find(lab => lab.lessons.length) ? { lab: data.labs.find(lab => lab.lessons.length), lesson: data.labs.find(lab => lab.lessons.length).lessons[0] } : null);
  if (loading && !data) return <p role="status">Đang tải chương trình học…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  return <>
    <header className="lms-heading"><div><h1>{experience ? 'Trải nghiệm CubeSAT' : preview ? 'Xem như sinh viên' : 'Chương trình học của lớp'}</h1><p>{preview ? 'Chế độ xem thử không ghi tiến độ hoặc điểm.' : 'Nội dung được giảng viên xuất bản cho lớp.'}</p></div><Link to={experience ? '/classes' : `/classes/${classId}`}>Về lớp học</Link></header>
    {!experience && <Link to={`/classes/${classId}/path`}>Lộ trình và tiến độ học tập</Link>}
    {!selected ? <p>Chưa có bài học được bật.</p> : <div className="curriculum-player">
      <nav aria-label="Chọn bài học" className="curriculum-outline">{data.labs.map(lab => <details key={lab.id} open={selected.lab.id === lab.id}><summary>{lab.access === 'locked' ? '🔒 ' : ''}Lab {lab.id}: {lab.title}</summary>{lab.lessons.map(lesson => {
        const locked = lesson.access === 'locked' || !lesson.content;
        const completed = ['completed', 'waived'].includes(lesson.progress?.status);
        return <button key={lesson.id} type="button" disabled={locked} aria-current={selected.lesson.id === lesson.id ? 'page' : undefined} aria-label={locked ? `${lesson.title}. Bạn cần hoàn thành bài học trước để mở khóa bài này.` : lesson.title} onClick={() => { const next = new URLSearchParams(search); next.set('lesson', lesson.id); setSearch(next); }}>
          <small>{locked ? '🔒 Chưa mở' : completed ? '✓ Đã hoàn thành' : types[lesson.type]}{lesson.progress?.status === 'pending_review' ? ' · Chờ chấm' : ''}</small>{lesson.title}
        </button>;
      })}</details>)}</nav>
      <article className="curriculum-content" key={`${classId}:${selected.lesson.id}`}><small>Lab {selected.lab.id} · {types[selected.lesson.type]}</small><h2>{selected.lesson.title}</h2>
        {!selected.lesson.content ? <section className="lms-notice"><h3>🔒 Bài học đang khóa</h3><p>Bạn cần hoàn thành bài học trước để mở khóa bài này.</p>{(selected.lesson.reason || selected.lab.reason) && <small>{selected.lesson.reason || selected.lab.reason}</small>}</section> : <LessonContent lesson={selected.lesson} labId={selected.lab.id} classId={classId} preview={preview || !data.learning_path} onRefresh={reload} />}
      </article>
    </div>}
  </>;
}
