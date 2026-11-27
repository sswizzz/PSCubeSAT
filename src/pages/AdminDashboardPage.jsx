import { useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const roles = { admin: 'Quản trị viên', teacher: 'Giảng viên', user: 'Người dùng' };
const statuses = { active: 'Đang mở', draft: 'Bản nháp', archived: 'Đã lưu trữ' };
const modes = {
  enabled: 'Bật LMS',
  read_only: 'Chỉ đọc',
  off: 'Tắt (luồng cũ)',
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
      setNotice({ message: `Đã chuyển ${pending.classroom.code} sang “${modes[pending.mode]}”.` }); setPending(null); setReason(''); reload();
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  return <section className="lms-panel">
    <div className="admin-mode-head">
      <h2>Chế độ theo lớp</h2>
      <details className="report-info">
        <summary>Giải thích chế độ</summary>
        <div>
          <p><strong>Chỉ đọc:</strong> chặn ghi, giữ dữ liệu, SV học nội dung trải nghiệm.</p>
          <p><strong>Tắt:</strong> đưa SV về luồng cũ ổn định.</p>
        </div>
      </details>
    </div>
    <Notice {...notice} />{error && <Notice error={error} />}
    {loading ? <p role="status">Đang tải danh sách lớp…</p> : data && <><div className="lms-table-wrap"><table><caption className="sr-only">Chế độ học theo lớp</caption>
      <thead><tr><th>Lớp</th><th>Trạng thái</th><th>Chế độ</th></tr></thead>
      <tbody>{data.items.map(item => <tr key={item.id}>
        <td><Link to={`/classes/${item.id}`}><strong>{item.name}</strong></Link><span className="lms-secondary">{item.code}</span></td>
        <td><span className={`lms-status ${item.status}`}>{statuses[item.status]}</span></td>
        <td><label className="sr-only" htmlFor={`mode-${item.id}`}>Chế độ lớp {item.code}</label><select className="admin-mode-select" id={`mode-${item.id}`} value={pending?.classroom.id === item.id ? pending.mode : item.lms_mode} onChange={event => setPending(event.target.value === item.lms_mode ? null : { classroom: item, mode: event.target.value })}>{Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
      </tr>)}</tbody></table></div>
      <Pagination page={page} total={data.total} onChange={next => { setPage(next); setPending(null); }} disabled={busy} /></>}
    {pending && <form className="lms-confirm" onSubmit={save}><p>Chuyển <strong>{pending.classroom.code}</strong> sang “{modes[pending.mode]}”? Có hiệu lực ngay.</p>
      <label>Lý do<textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="lms-actions"><button className="lms-primary" disabled={busy}>Xác nhận</button><button type="button" disabled={busy} onClick={() => setPending(null)}>Hủy</button></div></form>}
  </section>;
}

export default function AdminDashboardPage() {
  const { data, error, loading, reload } = useLmsResource('/api/admin/dashboard');
  if (loading) return <div className="admin-page-shell"><div className="admin-page-panel"><p role="status">Đang tổng hợp số liệu…</p></div></div>;
  if (error) return <div className="admin-page-shell"><div className="admin-page-panel"><Notice error={error} /><button onClick={reload}>Thử lại</button></div></div>;
  const total = Object.values(data.users).reduce((sum, item) => sum + Object.values(item).reduce((a, b) => a + b, 0), 0);
  return <div className="admin-page-shell">
    <header className="admin-dash-head">
      <div className="admin-dash-title">
        <h1>Tổng quan hệ thống</h1>
        <details className="report-info">
          <summary>Chú thích chỉ số</summary>
          <div>
            <p>{data.definitions.active_students}</p>
            <p>{data.definitions.completion_rate} {data.definitions.average_best_score}</p>
          </div>
        </details>
      </div>
      <button type="button" className="admin-primary-btn" onClick={reload}>Cập nhật</button>
    </header>

    <dl className="report-stats">
      <div className={total === 0 ? 'is-zero' : ''}><dt>Tài khoản</dt><dd>{total}</dd></div>
      <div className={data.classes.by_status.active === 0 ? 'is-zero' : ''}><dt>Lớp đang mở</dt><dd>{data.classes.by_status.active}</dd></div>
      <div className={data.active_students.last_7_days === 0 ? 'is-zero' : ''}><dt>SV hoạt động 7 ngày</dt><dd>{data.active_students.last_7_days}</dd></div>
      <div className={data.active_students.last_30_days === 0 ? 'is-zero' : ''}><dt>SV hoạt động 30 ngày</dt><dd>{data.active_students.last_30_days}</dd></div>
    </dl>

    <div className="admin-dash-grid">
      <section className="admin-panel">
        <h2>Tài khoản theo vai trò</h2>
        <div className="lms-table-wrap">
          <table>
            <caption className="sr-only">Thống kê số lượng tài khoản theo vai trò và trạng thái</caption>
            <thead><tr><th>Vai trò</th><th>Hoạt động</th><th>Khóa</th></tr></thead>
            <tbody>{Object.entries(roles).map(([key, label]) => <tr key={key}><td>{label}</td><td className="report-num">{data.users[key]?.active || 0}</td><td className={`report-num${!(data.users[key]?.locked) ? ' is-zero' : ''}`}>{data.users[key]?.locked || 0}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Hoàn thành & Lab Test</h2>
        {!data.labs.length ? <p className="admin-empty">Chưa có lớp mở với giáo trình đã xuất bản.</p> : <div className="lms-table-wrap"><table>
          <caption className="sr-only">Tỷ lệ hoàn thành và điểm trung bình Lab Test theo từng lab</caption>
          <thead><tr><th>Lab</th><th>Hoàn thành</th><th>Đạt / Tổng</th><th>Điểm TB</th><th>Đã thi</th></tr></thead>
          <tbody>{data.labs.map(lab => {
            const pct = lab.completion_rate === null ? null : Math.round(lab.completion_rate * 100);
            return (
              <tr key={lab.id}>
                <td><strong>Lab {lab.id}</strong></td>
                <td>{pct === null ? '—' : <div className="report-progress"><span className="report-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span><b>{percent(lab.completion_rate)}</b></div>}</td>
                <td className="report-num">{lab.completed_students}/{lab.eligible_students}</td>
                <td><span className={`report-score${lab.average_best_score === null ? ' is-empty' : ''}`}>{lab.average_best_score === null ? '—' : `${lab.average_best_score}/5`}</span></td>
                <td className="report-num">{lab.scored_students}</td>
              </tr>
            );
          })}</tbody>
        </table></div>}
      </section>
    </div>

    <ClassModes />
  </div>;
}
