import { Link, useParams } from 'react-router-dom';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

const TYPE_LABELS = {
  video: 'Video',
  document: 'Tài liệu',
  practice: 'Thực hành',
  quiz: 'Câu hỏi',
  labtest: 'Lab test',
};

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export default function LearningPathPage() {
  const { classId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/learning-path`);
  if (loading) return <p role="status">Đang tải lộ trình…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  const defaultOpenLabId = data.labs.find(lab => lab.access !== 'locked' && !lab.completed)?.id ?? data.labs[0]?.id ?? null;
  return <>
    <section className="path-summary">
      <div className="path-summary-main">
        <div className="path-summary-head">
          <h2>Lộ trình học tập</h2>
          <span className="path-summary-meta">{data.completed_labs}/{data.total_labs} lab · {data.percent}%</span>
        </div>
        <span className="report-bar" aria-hidden="true"><i style={{ width: `${data.percent}%` }} /></span>
      </div>
      {data.continue_lesson_id ? (
        <Link className="path-continue-btn" to={`/classes/${classId}/learn?lesson=${encodeURIComponent(data.continue_lesson_id)}`}>
          Tiếp tục học →
        </Link>
      ) : (
        <span className="path-summary-status">
          {data.completed_labs === data.total_labs ? 'Hoàn thành' : 'Đang chờ chấm'}
        </span>
      )}
    </section>
    <div className="path-labs">
      {data.labs.map(lab => (
        <details
          key={lab.id}
          className={`lms-panel path-lab${lab.access === 'locked' ? ' is-locked' : lab.completed ? ' is-done' : ''}`}
          open={lab.id === defaultOpenLabId}
        >
          <summary className="path-lab-summary">
            <div className="path-lab-title">
              <span className="path-lab-badge" aria-label={lab.completed ? `Lab ${lab.id} đã đạt` : lab.access === 'locked' ? `Lab ${lab.id} đang khóa` : `Lab ${lab.id}`}>
                {lab.completed && <CheckIcon />}
                {lab.access === 'locked' && <LockIcon />}
                <span>Lab {lab.id}</span>
              </span>
              <h3>{lab.title}</h3>
            </div>
            <div className="path-lab-meta">
              {lab.access === 'locked' ? (
                <span className="path-lab-reason-inline">{lab.reason || 'Chưa mở'}</span>
              ) : (
                <>
                  <span className="report-bar path-lab-progress" aria-hidden="true"><i style={{ width: `${lab.percent}%` }} /></span>
                  <span className="path-lab-count">{lab.completed_count}/{lab.required_count} bài</span>
                  <Link
                    className="path-lab-open"
                    to={`/classes/${classId}/learn?lesson=${encodeURIComponent(lab.lessons.find(item => item.access === 'available')?.id || lab.lessons[0]?.id || '')}`}
                    onClick={event => event.stopPropagation()}
                  >
                    {lab.completed ? 'Ôn lại' : 'Mở lab →'}
                  </Link>
                </>
              )}
            </div>
          </summary>
          {lab.lessons.some(item => item.status === 'pending_review') && (
            <p className="path-pending"><ClockIcon /> Có bài đang chờ chấm.</p>
          )}
          <ol className="path-lesson-list">
            {lab.lessons.map((lesson, index) => {
              const isNext = lesson.id === data.continue_lesson_id;
              const isPending = lesson.status === 'pending_review';
              const rowBody = (
                <>
                  {lesson.access === 'completed' ? (
                    <span className="path-lesson-icon is-done"><CheckIcon /></span>
                  ) : lesson.access === 'locked' ? (
                    <span className="path-lesson-icon is-locked"><LockIcon /></span>
                  ) : (
                    <span className="path-lesson-idx">{String(index + 1).padStart(2, '0')}</span>
                  )}
                  <span className="path-lesson-name">{lesson.title}</span>
                  {TYPE_LABELS[lesson.type] && (
                    <span className={`curriculum-type is-${lesson.type}`}>{TYPE_LABELS[lesson.type]}</span>
                  )}
                  <span className="path-lesson-tail">
                    {isPending ? (
                      <span className="path-lesson-pill is-pending"><ClockIcon /> Chờ chấm</span>
                    ) : lesson.access !== 'locked' ? (
                      <span className="path-lesson-arrow" aria-hidden="true">→</span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={lesson.id} className={`path-lesson${isNext ? ' is-next' : ''}`}>
                  {lesson.access === 'locked' ? (
                    <div className="path-lesson-row is-locked">{rowBody}</div>
                  ) : (
                    <Link
                      className={`path-lesson-row${isNext ? ' is-next' : ''}`}
                      to={`/classes/${classId}/learn?lesson=${encodeURIComponent(lesson.id)}`}
                    >
                      {rowBody}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      ))}
    </div>
  </>;
}
