import { useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const roles = { admin: 'Quản trị viên', teacher: 'Giảng viên', user: 'Người dùng' };
const statuses = { active: 'Đang mở', draft: 'Bản nháp', archived: 'Đã lưu trữ' };
const modes = {
  enabled: 'Đang bật học theo lớp',
  read_only: 'Chỉ đọc — tạm dừng ghi',
  off: 'Tắt — SV dùng luồng cũ',
};
const percent = value => value === null ? '—' : `${Math.round(value * 100)}%`;

function ClassModes() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLmsResource(`/api/classes?page=${page}&page_size=20`);
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice({});
    try {
      await request(`/api/admin/classes/${pending.classroom.id}/lms-mode`, { method: 'PATCH', body: JSON.stringify({ lms_mode: pending.mode, reason }) });
      setNotice({ message: `Đã chuyển lớp ${pending.classroom.code} sang “${modes[pending.mode]}”.` }); setPending(null); setReason(''); reload();
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  return <section className="lms-panel"><h2>Chế độ pilot theo lớp</h2>
    <p>“Chỉ đọc” là phương án rollback: mọi thao tác ghi của lớp bị chặn, dữ liệu và kết quả được giữ, SV dùng nội dung trải nghiệm. “Tắt” đưa SV của lớp về luồng ổn định cũ.</p>
    <Notice {...notice} />{error && <Notice error={error} />}
    {loading ? <p role="status">Đang tải danh sách lớp…</p> : data && <><div className="lms-table-wrap"><table><caption className="sr-only">Chế độ học theo lớp</caption>
      <thead><tr><th>Lớp</th><th>Trạng thái</th><th>Chế độ</th></tr></thead>
      <tbody>{data.items.map(item => <tr key={item.id}>
        <td><Link to={`/classes/${item.id}`}><strong>{item.name}</strong></Link><span className="lms-secondary">{item.code}</span></td>
        <td>{statuses[item.status]}</td>
        <td><label className="sr-only" htmlFor={`mode-${item.id}`}>Chế độ lớp {item.code}</label><select id={`mode-${item.id}`} value={pending?.classroom.id === item.id ? pending.mode : item.lms_mode} onChange={event => setPending(event.target.value === item.lms_mode ? null : { classroom: item, mode: event.target.value })}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
      </tr>)}</tbody></table></div>
      <Pagination page={page} total={data.total} onChange={next => { setPage(next); setPending(null); }} disabled={busy} /></>}
    {pending && <form className="lms-confirm" onSubmit={save}><p>Chuyển lớp <strong>{pending.classroom.code}</strong> từ “{modes[pending.classroom.lms_mode]}” sang “{modes[pending.mode]}”? Thay đổi có hiệu lực ngay với mọi phiên đang mở.</p>
      <label>Lý do (lưu nhật ký)<textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="lms-actions"><button className="lms-primary" disabled={busy}>Xác nhận</button><button type="button" disabled={busy} onClick={() => setPending(null)}>Hủy</button></div></form>}
  </section>;
}

export default function AdminDashboardPage() {
  const { data, error, loading, reload } = useLmsResource('/api/admin/dashboard');
  if (loading) return <div className="admin-page-shell"><div className="admin-page-panel"><p role="status">Đang tổng hợp số liệu…</p></div></div>;
  if (error) return <div className="admin-page-shell"><div className="admin-page-panel"><Notice error={error} /><button onClick={reload}>Thử lại</button></div></div>;
  const total = Object.values(data.users).reduce((sum, item) => sum + Object.values(item).reduce((a, b) => a + b, 0), 0);
  return <div className="admin-page-shell">
    <header className="admin-page-header">
      <div>
        <span className="admin-page-kicker">Overview</span>
        <h1>Tổng quan hệ thống</h1>
      </div>
      <button type="button" className="admin-primary-btn" onClick={reload}>Cập nhật</button>
    </header>

    <div className="admin-summary-grid">
      <article className="admin-card admin-card--accent"><span>Tài khoản</span><strong>{total}</strong><small>Tổng số người dùng</small></article>
      <article className="admin-card"><span>Lớp đang mở</span><strong>{data.classes.by_status.active}</strong><small>Học theo lớp</small></article>
      <article className="admin-card"><span>SV hoạt động 7 ngày</span><strong>{data.active_students.last_7_days}</strong><small>Nhịp độ gần đây</small></article>
      <article className="admin-card"><span>SV hoạt động 30 ngày</span><strong>{data.active_students.last_30_days}</strong><small>Khung 1 tháng</small></article>
    </div>

    <p className="admin-note">{data.definitions.active_students}</p>

    <section className="admin-panel">
      <h2>Tài khoản theo vai trò</h2>
      <div className="lms-table-wrap">
        <table>
          <thead><tr><th>Vai trò</th><th>Đang hoạt động</th><th>Đã khóa</th></tr></thead>
          <tbody>{Object.entries(roles).map(([key, label]) => <tr key={key}><td>{label}</td><td>{data.users[key]?.active || 0}</td><td>{data.users[key]?.locked || 0}</td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="admin-panel">
      <h2>Hoàn thành và Lab Test theo lab</h2>
      <p className="admin-note">{data.definitions.completion_rate} {data.definitions.average_best_score}</p>
      {!data.labs.length ? <p className="admin-empty">Chưa có lớp đang mở với chương trình đã xuất bản.</p> : <div className="lms-table-wrap"><table>
        <thead><tr><th>Lab</th><th>Tỷ lệ hoàn thành</th><th>SV đạt / SV có lab</th><th>Điểm Lab Test TB</th><th>SV đã thi</th></tr></thead>
        <tbody>{data.labs.map(lab => <tr key={lab.id}><td>Lab {lab.id}</td><td>{percent(lab.completion_rate)}</td><td>{lab.completed_students}/{lab.eligible_students}</td><td>{lab.average_best_score === null ? '—' : `${lab.average_best_score}/5`}</td><td>{lab.scored_students}</td></tr>)}</tbody>
      </table></div>}
    </section>

    <ClassModes />
  </div>;
}
