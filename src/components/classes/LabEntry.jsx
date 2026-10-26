import { Link, Navigate, useSearchParams } from 'react-router-dom';
import LoadingScreen from '../common/LoadingScreen';
import { useLmsResource } from './use-lms-resource';
import { Notice } from './LmsCommon';
import './classes.css';

function lessonQuery(lesson) {
  return lesson ? `?lesson=${encodeURIComponent(lesson)}` : '';
}

// Old /labN?lesson=... links: the server decides which class (if any) the user belongs in.
export default function LabEntry({ labId, children }) {
  const [search] = useSearchParams();
  const lesson = search.get('lesson');
  const { data, error, loading, reload } = useLmsResource(`/api/lms/lab-entry?lab_id=${labId}`, true);
  if (loading) return <LoadingScreen />;
  if (error) return <section className="lms-shell"><Notice error={error} /><button onClick={reload}>Thử lại</button> <Link to="/classes">Lớp của tôi</Link></section>;
  if (data.target === 'legacy') {
    return children;
  }
  if (data.target === 'experience') return <Navigate to={`/preview${lessonQuery(lesson)}`} replace />;
  if (data.target === 'locked') {
    return <section className="lms-shell">
      <Notice error={data.message || 'Bạn cần hoàn thành Lab trước để mở khóa Lab này.'} />
      <Link to={`/lab${Math.max(0, data.lab_id - 1)}`}>Quay lại Lab trước</Link>
    </section>;
  }
  if (data.target === 'class') return <Navigate to={lesson ? `/classes/${data.class_id}/learn${lessonQuery(lesson)}` : `/classes/${data.class_id}/path`} replace />;
  return <section className="lms-shell">
    <header className="lms-heading"><div><h1>Chọn lớp để mở Lab {labId}</h1><p>Bạn đang học Lab {labId} trong nhiều lớp. Tiến độ của mỗi lớp được tính riêng.</p></div></header>
    <div className="lms-class-list">{data.classes.map(item => <div className="lms-class-row" key={item.id}>
      <div><span className="lms-secondary">{item.code}</span><h2>{item.name}</h2></div>
      <Link to={lesson ? `/classes/${item.id}/learn${lessonQuery(lesson)}` : `/classes/${item.id}/path`}>Mở trong lớp này</Link>
    </div>)}</div>
  </section>;
}
