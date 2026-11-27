import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { request } from '../contexts/auth-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

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
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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
  return <section className="lms-panel"><h2>Chấm bài #{submissionId}</h2>
    {loading ? <p>Đang tải mã nguồn…</p> : error ? <Notice error={error} /> : <>
      <p className="lms-secondary">{data.lesson_id} · v{data.revision}</p><h3>Rubric</h3><p>{data.rubric}</p><pre className="submission-code">{data.code}</pre>
      <label>Nhận xét<textarea rows={3} value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={5000} /></label><Notice error={failure} />
      <div className="lms-actions"><button className="lms-primary" disabled={busy || !feedback.trim()} onClick={() => grade('approved')}>Duyệt</button><button disabled={busy || !feedback.trim()} onClick={() => grade('changes_requested')}>Yêu cầu sửa</button><button disabled={busy} onClick={onDone}>Đóng</button></div>
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
    <div className="progress-bar-head">
      <h2>Tiến độ & chấm bài</h2>
      <div className="progress-stats-inline">
        <span>{data.members.length} sinh viên</span>
        <span>{data.pending_submissions.length} chờ chấm</span>
      </div>
    </div>
    {!data.members.length ? <p className="lms-empty">Chưa có sinh viên trong lớp.</p> : (
      <div className="lms-table-wrap">
        <table className="progress-table">
          <caption className="sr-only">Tiến độ sinh viên theo lab</caption>
          <thead>
            <tr>
              <th className="progress-student-col">Sinh viên</th>
              {labs.map(lab => <th key={lab.id}>Lab {lab.id}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.members.map(member => (
              <tr key={member.membership_id}>
                <td className="progress-student-col">
                  <strong>{member.full_name || member.email}</strong>
                  <span className="lms-secondary">{member.email}{member.membership_status === 'removed' ? ' · Đã xóa' : ''}</span>
                </td>
                {member.labs.map(lab => (
                  <td key={lab.id} title={lab.reason}>
                    <span
                      className={`progress-pill${lab.completed ? ' is-done' : lab.access === 'locked' ? ' is-locked' : lab.percent > 0 ? ' is-active' : ''}`}
                      aria-label={lab.access === 'locked' ? 'Đang khóa' : undefined}
                    >
                      {lab.completed ? (
                        <><CheckIcon /><span>100%</span></>
                      ) : lab.access === 'locked' ? (
                        <LockIcon />
                      ) : (
                        `${Math.round(lab.percent)}%`
                      )}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {data.pending_submissions.length > 0 && (
      <section className="lms-panel">
        <h2>{data.pending_submissions.length} bài chờ chấm</h2>
        {data.pending_submissions.map(item => (
          <div className="pending-submission" key={item.id}>
            <span>{data.members.find(member => member.membership_id === item.membership_id)?.email} · {item.lesson_id} · v{item.revision}</span>
            <button onClick={() => setReview(item.id)}>Chấm bài</button>
          </div>
        ))}
      </section>
    )}
    {review && <Review key={review} classId={classId} submissionId={review} onDone={() => { setReview(null); reload(); }} />}
    <details className="lms-panel progress-override">
      <summary>
        <h2>Miễn bài / Mở khóa riêng</h2>
      </summary>
      <form onSubmit={override}>
        <div className="lms-form-grid">
          <label>Sinh viên<select required value={target} onChange={event => { setTarget(event.target.value); setLesson(''); setLabId(''); }}><option value="">Chọn sinh viên</option>{data.members.filter(item => item.membership_status === 'active').map(member => <option value={member.membership_id} key={member.membership_id}>{member.email}</option>)}</select></label>
          <label>Thao tác<select value={action} onChange={event => setAction(event.target.value)}><option value="waive">Miễn một bài</option><option value="unlock">Mở khóa lab</option></select></label>
          {action === 'waive' ? <label>Bài học<select required value={lesson} onChange={event => setLesson(event.target.value)}><option value="">Chọn bài</option>{selectedMember?.labs.flatMap(lab => lab.lessons.map(item => <option value={item.id} key={item.id}>Lab {lab.id}: {item.title}</option>))}</select></label> : <label>Lab<select required value={labId} onChange={event => setLabId(event.target.value)}><option value="">Chọn lab</option>{selectedMember?.labs.map(lab => <option key={lab.id} value={lab.id}>Lab {lab.id}</option>)}</select></label>}
          <label className="lms-wide">Lý do<textarea required minLength={5} maxLength={1000} rows={2} value={reason} onChange={event => setReason(event.target.value)} /></label>
        </div>
        <Notice {...notice} />
        <button className="lms-primary" disabled={busy}>Lưu</button>
      </form>
    </details>
  </>;
}
