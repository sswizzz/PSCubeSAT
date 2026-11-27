import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { request, useAuth } from '../contexts/auth-api';
import { ClassFields, Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

const statusLabels = { draft: 'Bản nháp', active: 'Đang mở', archived: 'Đã lưu trữ' };

function TeacherPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error } = useLmsResource(`/api/admin/users?role=teacher&status=active&search=${encodeURIComponent(query)}`);
  return <div className="lms-teacher-picker">
    <label>Tìm giảng viên<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc email giảng viên…" /></label>
    <button type="button" onClick={() => { setQuery(search); onChange(''); }}>Tìm</button>
    <label>Giảng viên phụ trách<select required value={value} onChange={event => onChange(event.target.value)} disabled={loading}>
      <option value="">{loading ? 'Đang tải…' : 'Chọn giảng viên'}</option>
      {data?.items.map(user => <option key={user.id} value={user.id}>{user.full_name || user.email} — {user.email}</option>)}
    </select></label>
    <Notice error={error} />
    {data?.total > 20 && <p className="lms-secondary">Hiển thị 20 kết quả đầu. Nhập email để lọc chính xác.</p>}
  </div>;
}

export default function ClassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = ['admin', 'teacher'].includes(user.role);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', term: '', status: 'draft' });
  const [teacher, setTeacher] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const { data, error, loading, reload } = useLmsResource(`/api/classes?page=${page}`);
  async function create(event) {
    event.preventDefault(); setBusy(true); setFailure('');
    try {
      const created = await request('/api/classes', { method: 'POST', body: JSON.stringify({ ...form, ...(user.role === 'admin' ? { teacher_id: Number(teacher) } : {}) }) });
      navigate(`/classes/${created.id}`);
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <header className="classes-bar">
      <div className="classes-bar-left">
        <h1>{canCreate ? 'Lớp học' : 'Lớp của tôi'}</h1>
        {data && <span className="classes-count">{data.total} lớp</span>}
      </div>
      {canCreate && (
        <button type="button" className="lms-primary" onClick={() => setCreating(!creating)}>
          {creating ? 'Đóng' : '+ Tạo lớp'}
        </button>
      )}
    </header>
    {creating && <form className="lms-panel" onSubmit={create}><h2>Tạo lớp học</h2><ClassFields value={form} onChange={setForm} creating />
      {user.role === 'admin' && <TeacherPicker value={teacher} onChange={setTeacher} />}
      <Notice error={failure} />
      <div className="lms-actions"><button className="lms-primary" disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo lớp'}</button><button type="button" disabled={busy} onClick={() => setCreating(false)}>Hủy</button></div>
    </form>}
    {loading ? <p role="status">Đang tải lớp học…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      {!data.items.length ? (
        <section className="lms-empty">
          <h2>{canCreate ? 'Chưa có lớp học' : 'Chưa tham gia lớp nào'}</h2>
          <p>{canCreate ? 'Bấm “+ Tạo lớp” để bắt đầu.' : 'Liên hệ giảng viên để được thêm vào lớp.'}</p>
        </section>
      ) : (
        <div className="classes-grid">
          {data.items.map(item => (
            <article key={item.id} className="class-card">
              <div className="class-card-top">
                <span className="class-card-code">{item.code}{item.term ? ` · ${item.term}` : ''}</span>
                <span className={`lms-status ${item.status}`}>{statusLabels[item.status]}</span>
              </div>
              <h2><Link to={`/classes/${item.id}`}>{item.name}</Link></h2>
              {item.description && <p className="class-card-desc">{item.description}</p>}
              <div className="class-card-foot">
                <Link className="class-card-sub" to={`/classes/${item.id}/learn`}>Mở bài học</Link>
                <Link className="class-card-cta" to={`/classes/${item.id}`}>{item.can_manage ? 'Quản lý →' : 'Vào lớp →'}</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination page={page} total={data.total} onChange={setPage} />
    </>}
  </>;
}
