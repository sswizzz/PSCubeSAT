import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CourseSidebar from './CourseSidebar';
import VideoPlayer from '../common/VideoPlayer';
import DocViewer from '../common/DocViewer';
import { authorizedFetch, useAuth } from '../../contexts/auth-api';
import { getAuthToken } from '../../contexts/auth-storage';
import { downloadFile } from '../editor/blockly-project';
import TelemetryControls from '../groundstation/TelemetryControls';
import PracticeVisualization from '../visualization/PracticeVisualization';
import { useLmsResource } from '../classes/use-lms-resource';

const LESSON_TYPE_LABELS = { video: 'Video', document: 'Tài liệu', practice: 'Thực hành', summary: 'Tổng hợp', components: 'Thành phần' };

function LabStateTitle({ lab, lesson, position }) {
  return <header className="lab-state-title lab-state-title--compact">
    <div className="lab-state-meta"><span className="lab-state-number">Lab {lab.id} · Phần {position}</span><span className="lab-state-section">{lesson.label}</span></div>
    <h1 className="lab-state-copy">{lab.id === 0 && lesson.type === 'video' ? lab.title : lesson.title}</h1>
    {lesson.exerciseCode && <code className="lesson-exercise-code">{lesson.exerciseCode}</code>}
  </header>;
}

export default function LabLayout(props) {
  const { data, error, loading } = useLmsResource('/api/curriculum/legacy');
  if (loading) return <p role="status">Đang tải giáo trình…</p>;
  if (error) return <p role="alert">{error}</p>;
  const lab = data.find(item => item.id === props.lab.id);
  return <LoadedLabLayout {...props} lab={lab} catalog={data} />;
}

function LoadedLabLayout({ lab, catalog, editorPanel, visualizationPanel = null, practiceActions = null, practiceVariant = 'split' }) {
  const mainRef = useRef(null);
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, user, markVideoWatched, markDocViewed } = useAuth();
  const [progress, setProgress] = useState([]);
  const [completeError, setCompleteError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const lessons = lab.lessons;
  const lesson = lessons.find(item => item.id === searchParams.get('lesson')) || lessons[0];
  const lessonIndex = lessons.indexOf(lesson);
  const firstPractice = lessons.find(item => item.type === 'practice');
  const videoUrl = lab?.id === 0 ? lab.videoUrl : lesson.videoUrl;
  const selectLesson = useCallback(id => setSearchParams(current => { const next = new URLSearchParams(current); next.set('lesson', id); return next; }), [setSearchParams]);
  const labProgress = progress.find(item => item.lab_id === lab.id);
  const lessonStates = useMemo(() => labProgress?.lessons || {}, [labProgress]);
  const completedCount = lessons.filter(item => lessonStates[item.id]?.completed).length;
  const completionPercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const firstIncomplete = lessons.findIndex(item => !lessonStates[item.id]?.completed);
  const elapsedSeconds = lessonStates[lesson.id]?.started_at
    ? Math.max(0, Math.floor((clock - Date.parse(lessonStates[lesson.id].started_at)) / 1000))
    : 0;
  const remainingSeconds = Math.max(0, 60 - elapsedSeconds);
  const canComplete = user?.role === 'teacher' || user?.role === 'admin'
    || Boolean(lessonStates[lesson.id]?.started_at && elapsedSeconds >= 60);
  const completeLesson = async () => {
    setCompleteError('');
    const response = await authorizedFetch(`/api/progress/${lab.id}/lessons/${encodeURIComponent(lesson.id)}/complete`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setCompleteError(body.message || 'Chưa đủ thời gian học tối thiểu 1 phút.');
      return;
    }
    setProgress(current => current.some(item => item.lab_id === lab.id)
      ? current.map(item => item.lab_id === lab.id ? body : item)
      : [...current, body]);
  };
  const downloadExample = async () => {
    const token = getAuthToken();
    setDownloading(true); setDownloadError('');
    try {
      const response = await authorizedFetch(`/api/curriculum/exercises/${encodeURIComponent(lesson.id)}/source`);
      if (!response.ok) throw new Error(response.status === 401 ? 'Vui lòng đăng nhập lại.' : 'Không tải được mã mẫu. Vui lòng thử lại.');
      const code = await response.text();
      if (token && token === getAuthToken()) downloadFile(`${lesson.id}.ino`, code, 'text/plain');
    } catch (error) { setDownloadError(error.message); }
    finally { setDownloading(false); }
  };

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [lab?.id, lesson.id]);
  useEffect(() => {
    if (!isAuthenticated || !lab) return;
    // The server currently stores lab-level flags, not lesson completion.
    if (lesson.type === 'video' && videoUrl) markVideoWatched(lab.id).catch(() => {});
    if (lesson.type === 'document') markDocViewed(lab.id).catch(() => {});
  }, [isAuthenticated, lab, lesson.type, videoUrl, markVideoWatched, markDocViewed]);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    authorizedFetch('/api/progress').then(response => response.json()).then(data => { if (active) setProgress(data); });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { active = false; clearInterval(timer); };
  }, [isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated || !lab || lessonStates[lesson.id]?.started_at) return;
    authorizedFetch(`/api/progress/${lab.id}/lessons/${encodeURIComponent(lesson.id)}/start`, { method: 'POST' })
      .then(response => response.json()).then(body => setProgress(current => current.some(item => item.lab_id === lab.id)
        ? current.map(item => item.lab_id === lab.id ? body : item)
        : [...current, body]));
  }, [isAuthenticated, lab, lesson.id, lessonStates]);
  useEffect(() => {
    if (firstIncomplete > 0 && lessonIndex > firstIncomplete) selectLesson(lessons[firstIncomplete].id);
  }, [firstIncomplete, lessonIndex, lessons, selectLesson]);

  if (!lab) return <div>Lab không tồn tại</div>;
  const scopedEditor = isValidElement(editorPanel) ? cloneElement(editorPanel, {
    key: lesson.id, exerciseId: lesson.type === 'practice' ? lesson.id : '', legacyFallback: lesson.id === firstPractice?.id,
  }) : editorPanel;

  return <div className="player-layout">
    <CourseSidebar labs={catalog} currentLabId={lab.id} activeLesson={lesson.id} onSelectLesson={selectLesson} progress={progress} userRole={user?.role} />
    <div className="player-main" ref={mainRef}>
      <TelemetryControls />
      {lab.id === 0 ? <nav className="lab-mobile-lessons" aria-label="Nội dung Lab 0">
        {lessons.map(item => <button key={item.id} type="button" className={lesson.id === item.id ? 'active' : ''} aria-current={lesson.id === item.id ? 'page' : undefined} onClick={() => selectLesson(item.id)}>{item.title}</button>)}
      </nav> : <div className="lab-mobile-lessons lab-mobile-lessons--curriculum">
        <label htmlFor={`lab-${lab.id}-lesson`}>Nội dung Lab {lab.id} · {lessons.length} phần</label>
        <select id={`lab-${lab.id}-lesson`} value={lesson.id} onChange={event => selectLesson(event.target.value)}>
          {lessons.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.label} · {item.exerciseCode || item.title}</option>)}
        </select>
      </div>}

      <div className="lab-course-view animate-fadeInUp" key={`${lab.id}:${lesson.id}`}>
        <LabStateTitle lab={lab} lesson={lesson} position={lessonIndex + 1} />
        <section className="lesson-progress-panel" aria-label="Tiến độ Lab">
          <div className="lesson-progress-heading"><div><strong>Tiến độ Lab {lab.id}</strong><small>{completedCount}/{lessons.length} lesson đã hoàn thành</small></div><b>{completionPercent}%</b></div>
          <div className="lesson-progress-track"><span style={{ width: `${completionPercent}%` }} /></div>
        </section>
        {lesson.type === 'video' && <>
          <section className="lab-workspace lab-video-workspace" aria-label={`${lesson.label}: ${lesson.title}`}>
            <span className="lab-workspace-badge lab-play-badge" aria-hidden="true">▶</span>
            <div className="lab-video-surface"><VideoPlayer url={videoUrl} /></div>
          </section>
          <section className="lesson-reading-card"><h2>Mục tiêu Lab {lab.id}</h2><p>{lab.description}</p><p>Nội dung phần này: {lesson.title}.</p></section>
        </>}
        {lesson.type === 'document' && <section className="lab-workspace lab-doc-workspace" aria-label={`${lesson.label}: ${lesson.title}`}>
          <span className="lab-workspace-badge" aria-hidden="true">▤</span>
          <div className="lab-doc-surface"><DocViewer key={lesson.id} docPath={lab.id === 0 ? lab.docPath : undefined} content={lesson.reading} /></div>
        </section>}
        {lesson.type === 'components' && <section className="lab-workspace lab-components-workspace" aria-label="Khám phá các phân hệ CubeSat">{visualizationPanel}</section>}
        {lesson.type === 'practice' && <>
          <section className="lesson-practice-brief" aria-label="Yêu cầu bài thực hành">
            <div><h2>Yêu cầu thực hành</h2><p>{lesson.title}.</p></div>
            <div className="lesson-example-links"><a href={lesson.repositoryUrl} target="_blank" rel="noreferrer">Hướng dẫn trên PTITCube ↗</a><button type="button" className="btn btn-sm btn-outline" disabled={downloading} onClick={downloadExample}>{downloading ? 'Đang tải mã mẫu…' : 'Tải mã mẫu ESP32 (.ino)'}</button>{downloadError && <small role="alert">{downloadError}</small>}</div>
          </section>
          <section className={`lab-workspace lab-practice-workspace lab-practice-workspace--${practiceVariant}`} aria-label={`Không gian thực hành ${lesson.exerciseCode}`}>
            <div className={`lab-practice-panels lab-practice-panels--${practiceVariant}`}>
              <div className="lab-practice-editor">
                <div className="lab-practice-editor-frame">{scopedEditor}</div>
                {practiceVariant !== 'split' && <div className="lab-practice-actions lab-practice-actions--inline" aria-label="Thao tác thực hành" key={lesson.id}>{practiceActions}</div>}
              </div>
              <div className="lab-practice-visualization"><PracticeVisualization /></div>
            </div>
            {practiceVariant === 'split' && <div className="lab-practice-actions" aria-label="Thao tác thực hành" key={lesson.id}>{practiceActions}</div>}
          </section>
        </>}
        {lesson.type === 'summary' && <section className="lesson-reading-card">
          <h2>Kết quả cần đạt</h2><p>{lesson.description}</p>
          <h2>Đối chiếu các bài thực hành</h2><p>Kiểm tra mã biên dịch, lưu lại kết quả quan sát và giải thích cách chương trình đáp ứng yêu cầu của từng bài.</p>
          <ul className="lesson-summary-list">{lessons.filter(item => item.type === 'practice').map(item => <li key={item.id}><button type="button" onClick={() => selectLesson(item.id)}><code>{item.exerciseCode}</code><span>{item.title}</span></button></li>)}</ul>
          <p>Lưu mã .ino, file Blockly và kết quả kiểm thử để đưa vào báo cáo Lab {lab.id}.</p>
        </section>}
        <nav className="lesson-pagination" aria-label="Chuyển phần học">
          <button type="button" disabled={lessonIndex === 0} onClick={() => selectLesson(lessons[lessonIndex - 1].id)}>← Phần trước</button>
          <span>{lessonIndex + 1} / {lessons.length} · {LESSON_TYPE_LABELS[lesson.type]}</span>
          <button type="button" disabled={lessonIndex === lessons.length - 1} onClick={() => selectLesson(lessons[lessonIndex + 1].id)}>Phần tiếp theo →</button>
        </nav>
        <section className="lesson-completion">
          <button type="button" className="btn btn-primary" disabled={!canComplete || lessonStates[lesson.id]?.completed} onClick={completeLesson}>
            {lessonStates[lesson.id]?.completed ? '✓ Đã hoàn thành bài học' : canComplete ? 'Hoàn thành bài học' : `Đã học ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')} · còn ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`}
          </button>
          {completeError && <p role="alert">{completeError}</p>}
        </section>
      </div>
    </div>
  </div>;
}
