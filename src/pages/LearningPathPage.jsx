import { Link, useParams } from 'react-router-dom';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

export default function LearningPathPage() {
  const { classId } = useParams();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}/learning-path`);
  if (loading) return <p role="status">Đang tải lộ trình…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  return <>
    <header className="lms-heading"><div><h1>Lộ trình học tập</h1><p>Hoàn thành các yêu cầu của lab để mở các bước tiếp theo.</p></div><Link to={`/classes/${classId}`}>Về lớp học</Link></header>
    <section className="lms-panel path-overview"><div><strong>{data.completed_labs}/{data.total_labs} lab đã đạt</strong><progress value={data.percent} max={100} aria-label="Tiến độ khóa học" /><span>{data.percent}% hoàn thành</span></div>
      {data.continue_lesson_id ? <Link className="path-continue" to={`/classes/${classId}/learn?lesson=${encodeURIComponent(data.continue_lesson_id)}`}>Tiếp tục học</Link> : <p>{data.completed_labs === data.total_labs ? 'Bạn đã hoàn thành chương trình của lớp.' : 'Các bài còn lại đang chờ đánh giá.'}</p>}
    </section>
    <ol className="learning-path-list">{data.labs.map(lab => <li key={lab.id} className={lab.access === 'locked' ? 'path-locked' : ''}>
      <span className="path-state" aria-label={lab.completed ? 'Đã đạt' : lab.access === 'locked' ? 'Đang khóa' : 'Có thể học'}>{lab.completed ? '✓' : lab.access === 'locked' ? '🔒' : lab.id}</span>
      <section><h2>Lab {lab.id}: {lab.title}</h2><p>{lab.completed_count}/{lab.required_count} bài bắt buộc đã đạt</p><progress value={lab.percent} max={100} aria-label={`Tiến độ Lab ${lab.id}`} />
        {lab.access === 'locked' ? <p className="path-reason">{lab.reason}</p> : <Link to={`/classes/${classId}/learn?lesson=${encodeURIComponent(lab.lessons.find(item => item.access === 'available')?.id || lab.lessons[0]?.id || '')}`}>{lab.completed ? 'Ôn lại lab' : 'Mở lab'}</Link>}
        <ol className="path-lesson-list">{lab.lessons.map(lesson => <li key={lesson.id} className={`path-lesson path-lesson-${lesson.access}`}>
          <span aria-hidden="true">{lesson.access === 'completed' ? '✓' : lesson.access === 'locked' ? '🔒' : '○'}</span>
          <span>{lesson.title}</span>
          <small>{lesson.access === 'completed' ? 'Đã hoàn thành' : lesson.access === 'locked' ? 'Chưa mở' : 'Đang học'}</small>
        </li>)}</ol>
        {lab.lessons.some(item => item.status === 'pending_review') && <p>⌛ Có bài đang chờ giảng viên chấm.</p>}
      </section>
    </li>)}</ol>
  </>;
}
