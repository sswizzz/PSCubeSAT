import { Link, useParams } from 'react-router-dom';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

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
              <span className="path-lab-badge" aria-label={lab.completed ? 'Đã đạt' : lab.access === 'locked' ? 'Đang khóa' : `Lab ${lab.id}`}>
                {lab.completed ? '✓' : lab.access === 'locked' ? '🔒' : `Lab ${lab.id}`}
              </span>
              <h3>{lab.title}</h3>
            </div>
            <div className="path-lab-meta">
              <span className="path-lab-count">{lab.completed_count}/{lab.required_count} bài</span>
              {lab.access !== 'locked' && (
                <Link
                  className="path-lab-open"
                  to={`/classes/${classId}/learn?lesson=${encodeURIComponent(lab.lessons.find(item => item.access === 'available')?.id || lab.lessons[0]?.id || '')}`}
                  onClick={event => event.stopPropagation()}
                >
                  {lab.completed ? 'Ôn lại' : 'Mở lab →'}
                </Link>
              )}
            </div>
          </summary>
          {lab.access === 'locked' && lab.reason && <p className="path-reason">{lab.reason}</p>}
          {lab.lessons.some(item => item.status === 'pending_review') && <p className="path-pending">⌛ Có bài đang chờ chấm.</p>}
          <ol className="path-lesson-list">
            {lab.lessons.map(lesson => (
              <li key={lesson.id} className={`path-lesson path-lesson-${lesson.access}`}>
                <span aria-hidden="true">{lesson.access === 'completed' ? '✓' : lesson.access === 'locked' ? '🔒' : '○'}</span>
                {lesson.access === 'locked' ? (
                  <span>{lesson.title}</span>
                ) : (
                  <Link to={`/classes/${classId}/learn?lesson=${encodeURIComponent(lesson.id)}`}>{lesson.title}</Link>
                )}
                <small>{lesson.access === 'completed' ? 'Đạt' : lesson.access === 'locked' ? 'Khóa' : 'Mở'}</small>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  </>;
}
