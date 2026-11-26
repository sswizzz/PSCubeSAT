import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { Notice } from './LmsCommon';
import { useLmsResource } from './use-lms-resource';

const STATUS_LABELS = {
  active: 'Đang mở',
  draft: 'Bản nháp',
  archived: 'Đã lưu trữ',
};

export default function ClassLayout() {
  const { classId } = useParams();
  const location = useLocation();
  const { data, loading, error, reload } = useLmsResource(`/api/classes/${classId}`);

  if (loading) return <p role="status">Đang tải thông tin lớp…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;

  const isQuestionBank = /\/classes\/\d+\/(?:labs\/[^/]+|lessons\/[^/]+)\/questions\/?$/.test(location.pathname);

  return (
    <>
      <header className="lms-heading">
        <div>
          <span className="lms-secondary">{data.code}{data.term ? ` · ${data.term}` : ''}</span>
          <h1>{data.name}</h1>
          <p>{data.description || 'Chưa có mô tả lớp.'}</p>
        </div>
        <span className={`lms-status ${data.status}`}>
          {STATUS_LABELS[data.status]}
        </span>
      </header>
      <nav className="lms-actions curriculum-links" aria-label="Điều hướng lớp học">
        <NavLink to={`/classes/${classId}`} end>Thông tin lớp</NavLink>
        <NavLink to={`/classes/${classId}/path`}>Lộ trình học tập</NavLink>
        <NavLink to={`/classes/${classId}/learn`}>Mở chương trình học</NavLink>
        {data.can_manage && (
          <>
            <NavLink
              to={`/classes/${classId}/curriculum`}
              className={({ isActive }) => (isActive || isQuestionBank ? 'active' : '')}
            >
              Cấu hình chương trình
            </NavLink>
            <NavLink to={`/classes/${classId}/progress`}>Tiến độ và chấm bài</NavLink>
            <NavLink to={`/classes/${classId}/report`}>Báo cáo lớp</NavLink>
          </>
        )}
      </nav>
      <Outlet context={{ classroom: data, reloadClass: reload }} />
    </>
  );
}
