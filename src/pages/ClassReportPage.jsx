import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authorizedFetch } from '../contexts/auth-api';
import { useLmsResource } from '../components/classes/use-lms-resource';
import { Notice } from '../components/classes/LmsCommon';

const dateTime = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
const shortDateTime = value => value
  ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—';
const initial = student => ((student.full_name || student.email || '?').trim()[0] || '?').toUpperCase();
const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));

export default function ClassReportPage() {
  const { classId } = useParams();
  const url = `/api/classes/${classId}/reports`;
  const { data, error, loading, reload } = useLmsResource(url);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  async function exportCsv() {
    setBusy(true); setFailure('');
    try {
      const response = await authorizedFetch(`${url}?format=csv`);
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không xuất được báo cáo.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob());
      link.download = `bao-cao-lop-${classId}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) { setFailure(err.message); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status">Đang tổng hợp báo cáo lớp…</p>;
  if (error) return <><Notice error={error} /><button onClick={reload}>Thử lại</button></>;
  const labs = data.students[0]?.labs || [];
  const { summary } = data;
  return <div className="report-page">
    <header className="lms-heading report-head">
      <div>
        <h1>Báo cáo lớp</h1>
        <div className="report-meta">
          <span>Cập nhật {dateTime(data.generated_at)}</span>
          <details className="report-info">
            <summary>Cách tính hoạt động</summary>
            <div>
              <p>{data.activity_definition}</p>
              <p>Lịch sử biên dịch từ hệ thống cũ chỉ để tham khảo. Nếu SV đã hoàn thành tương đương, dùng “Miễn một bài” kèm lý do ở trang chấm bài.</p>
            </div>
          </details>
        </div>
      </div>
      <div className="lms-actions report-actions">
        <button className="lms-primary" disabled={busy || !data.students.length} onClick={exportCsv}>{busy ? 'Đang xuất…' : 'Xuất CSV'}</button>
        <button disabled={busy} onClick={reload}>Cập nhật</button>
        <Link to={`/classes/${classId}/progress`}>Chấm bài</Link>
      </div>
    </header>
    <Notice error={failure} />
    <dl className="report-stats">
      <div><dt>Sinh viên</dt><dd>{summary.active_students}</dd></div>
      <div>
        <dt>Tiến độ TB</dt>
        <dd>{summary.average_percent}%</dd>
        <span className="report-bar" aria-hidden="true"><i style={{ width: `${clampPercent(summary.average_percent)}%` }} /></span>
      </div>
      <div className={summary.pending_reviews > 0 ? 'is-alert' : 'is-zero'}><dt>Chờ duyệt</dt><dd>{summary.pending_reviews}</dd></div>
      <div><dt>Lab đang mở</dt><dd>{summary.total_labs}</dd></div>
    </dl>
    {!data.students.length ? <p className="lms-empty">Lớp chưa có sinh viên.</p> : <div className="lms-table-wrap report-table-wrap"><table className="report-table">
      <caption className="sr-only">Tiến độ, điểm Lab Test và hoạt động của từng sinh viên</caption>
      <thead>
        <tr>
          <th rowSpan={2} className="report-student-col">Sinh viên</th>
          <th rowSpan={2}>Tiến độ</th>
          <th rowSpan={2}>Lab đạt</th>
          <th rowSpan={2}>Lượt thi</th>
          <th rowSpan={2}>Chờ duyệt</th>
          <th rowSpan={2}>Hoạt động</th>
          {labs.length > 0 && <th colSpan={labs.length} className="report-group">Điểm Lab Test cao nhất</th>}
        </tr>
        {labs.length > 0 && <tr>{labs.map(lab => <th key={lab.id} className="report-lab-col">Lab {lab.id}</th>)}</tr>}
      </thead>
      <tbody>{data.students.map(student => <tr key={student.membership_id}>
        <td className="report-student-col">
          <div className="report-student">
            <span className="report-avatar" aria-hidden="true">{initial(student)}</span>
            <div>
              <strong>{student.full_name || student.email}</strong>
              <span className="lms-secondary report-email" title={student.email}>{student.email}</span>
              {(student.membership_status === 'removed' || student.legacy_compiled_labs.length > 0) && <span className="report-chips">
                {student.membership_status === 'removed' && <em className="report-chip is-muted">Đã rời lớp</em>}
                {student.legacy_compiled_labs.length > 0 && <em className="report-chip" title="Lịch sử biên dịch cũ, không tính hoàn thành">Biên dịch cũ: Lab {student.legacy_compiled_labs.join(', ')}</em>}
              </span>}
            </div>
          </div>
        </td>
        <td><div className="report-progress"><span className="report-bar" aria-hidden="true"><i style={{ width: `${clampPercent(student.percent)}%` }} /></span><b>{Math.round(student.percent)}%</b></div></td>
        <td className="report-num">{student.completed_labs}/{student.total_labs}</td>
        <td className={`report-num${student.attempts_total ? '' : ' is-zero'}`}>{student.attempts_total}</td>
        <td className={`report-num${student.pending_reviews ? ' is-alert' : ' is-zero'}`}>{student.pending_reviews}</td>
        <td className="report-when" title={dateTime(student.last_activity_at)}>{shortDateTime(student.last_activity_at)}</td>
        {student.labs.map(lab => <td key={lab.id} className="report-lab-col">
          {lab.best_score === null
            ? <span className="report-score is-empty">—</span>
            : <span className={`report-score${lab.completed ? ' is-done' : ''}`}>{lab.completed ? '✓ ' : ''}{lab.best_score}/5</span>}
          {lab.attempts > 0 && <span className="lms-secondary report-tries">{lab.attempts} lượt</span>}
        </td>)}
      </tr>)}</tbody>
    </table></div>}
  </div>;
}
