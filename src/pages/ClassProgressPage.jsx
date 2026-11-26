import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

function Review({ classId, submissionId, onDone }) {
  const { data, error, loading } = useLmsResource(`/api/classes/${classId}/submissions/${submissionId}`);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function grade(verdict) {
    setBusy(true); setFailure('');
    try {
      await request(`/api/classes/${classId}/submissions/${submissionId}/review`, { method: 'POST', body: JSON.stringify({ verdict, feedback }) });
      onDone();
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }
  return <section className="lms-panel"><h2>Chấm bài nộp #{submissionId}</h2>
    {loading ? <p>Đang tải mã nguồn…</p> : error ? <Notice error={error} /> : <>
      <p>{data.lesson_id} · Phiên bản {data.revision}</p><h3>Rubric tại lúc nộp</h3><p>{data.rubric}</p><pre className="submission-code">{data.code}</pre>
      <label>Nhận xét theo rubric<textarea rows={4} value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={5000} /></label><Notice error={failure} />
      <div className="lms-actions"><button disabled={busy || !feedback.trim()} onClick={() => grade('approved')}>Duyệt hoàn thành</button><button disabled={busy || !feedback.trim()} onClick={() => grade('changes_requested')}>Yêu cầu sửa</button><button disabled={busy} onClick={onDone}>Đóng</button></div>
    </>}
  </section>;
}

export default function ClassProgressPage() {
  const { classId } = useParams();
  const { data, error, loading, reload } = useLmsResource(`/api/classes/${classId}/progress`);
  const [review, setReview] = useState(null);
  const [target, setTarget] = useState('');
  const [action, setAction] = useState('waive');
  const [lesson, setLesson] = useState('');
  const [labId, setLabId] = useState('');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState({});
  const [busy, setBusy] = useState(false);
  async function override(event) {
    event.preventDefault(); setBusy(true); setNotice({});
    try {
      await request(`/api/classes/${classId}/completion-overrides`, { method: 'POST', body: JSON.stringify({
        idempotency_key: crypto.randomUUID(), membership_id: Number(target), action, reason,
        ...(action === 'waive' ? { lesson_id: lesson } : { lab_id: Number(labId) }),
      }) });
      setNotice({ message: 'Đã ghi nhận thay đổi và lý do trong nhật ký.' }); setReason(''); reload();
    } catch (failure) { setNotice({ error: failure.message }); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Đang tải tiến độ lớp…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  if (!data.members) return <><h1>Tiến độ của tôi</h1><Link to={`/classes/${classId}/path`}>Mở lộ trình học tập</Link></>;
  const labs = data.members[0]?.labs || [];
  const selectedMember = data.members.find(item => String(item.membership_id) === target);
  return <>
    <header className="lms-heading"><div><h1>Tiến độ và bài chờ chấm</h1><p>Theo dõi sinh viên theo từng lab và duyệt kết quả thực hành.</p></div></header>
    <div className="lms-table-wrap"><table><caption className="sr-only">Tiến độ sinh viên theo lab</caption><thead><tr><th>Sinh viên</th>{labs.map(lab => <th key={lab.id}>Lab {lab.id}</th>)}</tr></thead><tbody>{data.members.map(member => <tr key={member.membership_id}><td><strong>{member.full_name || member.email}</strong><span className="lms-secondary">{member.email}{member.membership_status === 'removed' ? ' · Đã xóa khỏi lớp' : ''}</span></td>{member.labs.map(lab => <td key={lab.id} title={lab.reason}>{lab.completed ? '✓ ' : lab.access === 'locked' ? '🔒 ' : ''}{lab.percent}%</td>)}</tr>)}</tbody></table></div>
    {!data.members.length && <p>Chưa có sinh viên trong lớp.</p>}
    <section className="lms-panel"><h2>{data.pending_submissions.length} bài đang chờ chấm</h2>{data.pending_submissions.map(item => <div className="pending-submission" key={item.id}><span>{data.members.find(member => member.membership_id === item.membership_id)?.email} · {item.lesson_id} · v{item.revision}</span><button onClick={() => setReview(item.id)}>Mở và chấm bài</button></div>)}</section>
    {review && <Review key={review} classId={classId} submissionId={review} onDone={() => { setReview(null); reload(); }} />}
    <form className="lms-panel" onSubmit={override}><h2>Miễn yêu cầu hoặc mở khóa riêng</h2><p>Mở khóa chỉ cấp quyền truy cập; miễn bài được lưu thành kết quả waived, kèm lý do.</p><div className="lms-form-grid">
      <label>Sinh viên<select required value={target} onChange={event => { setTarget(event.target.value); setLesson(''); setLabId(''); }}><option value="">Chọn sinh viên</option>{data.members.filter(item => item.membership_status === 'active').map(member => <option value={member.membership_id} key={member.membership_id}>{member.email}</option>)}</select></label>
      <label>Thao tác<select value={action} onChange={event => setAction(event.target.value)}><option value="waive">Miễn một bài</option><option value="unlock">Mở khóa một lab</option></select></label>
      {action === 'waive' ? <label>Bài học<select required value={lesson} onChange={event => setLesson(event.target.value)}><option value="">Chọn bài</option>{selectedMember?.labs.flatMap(lab => lab.lessons.map(item => <option value={item.id} key={item.id}>Lab {lab.id}: {item.title}</option>))}</select></label> : <label>Lab<select required value={labId} onChange={event => setLabId(event.target.value)}><option value="">Chọn lab</option>{selectedMember?.labs.map(lab => <option key={lab.id} value={lab.id}>Lab {lab.id}</option>)}</select></label>}
      <label className="lms-wide">Lý do<textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={event => setReason(event.target.value)} /></label>
    </div><Notice {...notice} /><button disabled={busy}>Lưu thay đổi có lý do</button></form>
  </>;
}
