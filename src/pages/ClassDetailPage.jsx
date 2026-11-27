import { useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { ClassFields, Notice, Pagination } from '../components/classes/LmsCommon';
import { useLmsResource } from '../components/classes/use-lms-resource';

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

function Members({ classroom }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('active');
  const [email, setEmail] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({});
  const [removing, setRemoving] = useState(null);
  const fileInputRef = useRef(null);
  const url = `/api/classes/${classroom.id}/members`;
  const { data, error, loading, reload } = useLmsResource(`${url}?page=${page}&status=${status}`);
  const writable = classroom.status !== 'archived';
  async function mutate(method, payload, message) {
    setBusy(true); setNotice({}); setImportReport(null);
    try {
      await request(url, { method, body: JSON.stringify(payload) });
      setNotice({ message }); setRemoving(null); setEmail(''); reload();
    } catch (failure) {
      setNotice({ error: failure.message });
      if (failure.status === 403) reload();
    } finally { setBusy(false); }
  }
  async function importStudents(event) {
    event.preventDefault();
    if (!importFile) return;
    const name = importFile.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      setNotice({ error: 'Chỉ hỗ trợ tệp định dạng .xlsx hoặc .csv.' });
      return;
    }
    if (importFile.size > 1000000) {
      setNotice({ error: 'Chọn tệp Excel (.xlsx) hoặc CSV (.csv) tối đa 1 MB.' });
      return;
    }
    setBusy(true); setNotice({}); setImportReport(null);
    try {
      const format = name.endsWith('.xlsx') ? 'xlsx' : 'csv';
      const content = format === 'xlsx' ? toBase64(await importFile.arrayBuffer()) : await importFile.text();
      const result = await request(`${url}/import`, { method: 'POST', body: JSON.stringify({ format, content }) });
      setImportReport(result);
      setNotice({
        message: `Đã xử lý ${result.total_rows} dòng: thêm mới ${result.added_count}, khôi phục ${result.restored_count}, đã có trong lớp ${result.already_active_count}, bỏ qua ${result.skipped_count}.`,
      });
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      reload();
    } catch (failure) {
      setNotice({ error: failure.message });
      if (failure.status === 403) reload();
    } finally { setBusy(false); }
  }
  return <section className="lms-panel">
    <div className="class-members-head">
      <h2>Thành viên lớp</h2>
      <div className="class-members-controls">
        <select aria-label="Lọc trạng thái thành viên" value={status} onChange={event => { setStatus(event.target.value); setPage(1); setRemoving(null); }}>
          <option value="active">Đang tham gia</option>
          <option value="removed">Đã xóa khỏi lớp</option>
        </select>
        {writable && (
          <details className="class-import-toggle">
            <summary>Nhập Excel / CSV</summary>
            <div className="lms-import-box class-import-body">
              <div className="lms-import-head">
                <span className="lms-secondary">
                  Cột: <code>email</code> (bắt buộc), <code>full_name</code> · <a href="/templates/class-students.xlsx" download>Mẫu .xlsx</a> · <a href="/templates/class-students.csv" download>Mẫu .csv</a>
                </span>
              </div>
              <form className="lms-filters" onSubmit={importStudents}>
                <label>Tệp danh sách (.xlsx, .csv)
                  <input ref={fileInputRef} type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required onChange={event => setImportFile(event.target.files?.[0] || null)} />
                </label>
                <button disabled={busy || !importFile}>Nhập tệp</button>
              </form>
            </div>
          </details>
        )}
      </div>
    </div>
    {writable && (
      <form className="class-add-form" onSubmit={event => { event.preventDefault(); mutate('POST', { email }, 'Sinh viên đã có trong danh sách lớp.'); }}>
        <input type="email" required aria-label="Email sinh viên" value={email} onChange={event => setEmail(event.target.value)} placeholder="Nhập email sinh viên để thêm nhanh…" />
        <button className="lms-primary" disabled={busy}>Thêm</button>
      </form>
    )}
    <Notice {...notice} />
    {importReport?.skipped?.length > 0 && <div className="lms-table-wrap lms-import-skipped">
      <table>
        <caption className="sr-only">Danh sách các dòng bị bỏ qua khi nhập</caption>
        <thead><tr><th>Dòng</th><th>Email</th><th>Họ tên</th><th>Lý do bỏ qua</th></tr></thead>
        <tbody>{importReport.skipped.map(item => <tr key={`${item.row}:${item.email}`}><td>{item.row}</td><td>{item.email || '—'}</td><td>{item.full_name || '—'}</td><td>{item.reason}</td></tr>)}</tbody>
      </table>
    </div>}
    {removing && <section className="lms-confirm"><p>Xóa <strong>{removing.email}</strong> khỏi lớp? Dữ liệu học tập vẫn được giữ lại.</p><div className="lms-actions"><button disabled={busy} onClick={() => mutate('DELETE', { user_id: removing.user_id }, 'Đã xóa sinh viên khỏi lớp.')}>Xóa</button><button disabled={busy} onClick={() => setRemoving(null)}>Hủy</button></div></section>}
    {loading ? <p role="status">Đang tải thành viên…</p> : error ? <><Notice error={error} /><button onClick={reload}>Thử lại</button></> : <>
      <div className="lms-table-wrap"><table><caption className="sr-only">Danh sách thành viên lớp</caption><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>{data.items.map(member => <tr key={member.id}><td><strong>{member.full_name || 'Chưa có tên'}</strong><span className="lms-secondary">{member.email}</span></td><td>{member.role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}</td><td>{writable && member.role === 'student' && (status === 'active' ? <button disabled={busy} onClick={() => setRemoving(member)}>Xóa</button> : <button disabled={busy} onClick={() => mutate('POST', { email: member.email }, 'Đã phục hồi sinh viên vào lớp.')}>Thêm lại</button>)}</td></tr>)}</tbody></table></div>
      {!data.items.length && <p className="lms-empty">Chưa có thành viên.</p>}
      <Pagination page={page} total={data.total} onChange={setPage} disabled={busy} />
    </>}
  </section>;
}

function ClassEditor({ classroom, onSaved }) {
  const [form, setForm] = useState({ name: classroom.name, term: classroom.term || '', description: classroom.description || '', status: classroom.status });
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await request(`/api/classes/${classroom.id}`, { method: archive ? 'DELETE' : 'PATCH', ...(archive ? {} : { body: JSON.stringify(form) }) });
      onSaved(archive ? 'Đã lưu trữ lớp.' : 'Đã lưu thông tin lớp.');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <form className="lms-panel" onSubmit={save}><h2>Thông tin lớp</h2><ClassFields value={form} onChange={setForm} /><Notice error={error} />
    {archive && <p className="lms-confirm">Lưu trữ lớp sẽ khóa chỉnh sửa thông tin và thành viên.</p>}
    <div className="lms-actions"><button className="lms-primary" disabled={busy}>{busy ? 'Đang lưu…' : archive ? 'Xác nhận lưu trữ' : 'Lưu thông tin'}</button><button type="button" disabled={busy} onClick={() => setArchive(!archive)}>{archive ? 'Hủy' : 'Lưu trữ lớp'}</button></div>
  </form>;
}

export default function ClassDetailPage() {
  const { classroom: data, reloadClass: reload } = /** @type {{ classroom: any, reloadClass: () => void }} */ (useOutletContext());
  const [message, setMessage] = useState('');
  return <>
    <Notice message={message} />
    {data.lms_mode === 'read_only' && <p className="lms-notice" role="status">Lớp đang tạm dừng ghi dữ liệu. Có thể <Link to="/preview">học nội dung trải nghiệm</Link>.</p>}
    {data.lms_mode === 'off' && <p className="lms-notice" role="status">Lớp chưa bật chế độ học theo lớp.</p>}
    {data.can_manage ? <>
      {data.status !== 'archived' && <ClassEditor key={`${data.id}:${data.updated_at}`} classroom={data} onSaved={text => { setMessage(text); reload(); }} />}
      <Members key={data.id} classroom={data} />
    </> : <section className="lms-panel"><h2>Thông tin tham gia</h2><p>Bạn đang tham gia lớp với vai trò sinh viên.</p>{data.status === 'archived' && <p className="lms-secondary">Lớp đã được lưu trữ.</p>}</section>}
  </>;
}
