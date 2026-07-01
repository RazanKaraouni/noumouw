import { Badge, riskBadgeTone, formatDate } from './ui/TherapistUI';

export default function ScreeningResponsesPanel({ screening }) {
  if (!screening) {
    return <p className="td-meta">No screening results on file.</p>;
  }

  const responses = [...(screening.responses || [])].sort(
    (a, b) => Number(a.question_number) - Number(b.question_number),
  );

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div className="td-meta">Score</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{screening.score ?? '-'}</div>
        </div>
        <div>
          <div className="td-meta">Risk level</div>
          <Badge tone={riskBadgeTone(screening.risk_level)}>{screening.risk_level || '-'}</Badge>
        </div>
        <div>
          <div className="td-meta">Screening date</div>
          <div style={{ fontSize: 14 }}>{formatDate(screening.created_at)}</div>
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="td-meta">No question responses recorded for this screening.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="td-meta" style={{ marginBottom: 4 }}>Questions &amp; answers</p>
          {responses.map((q) => {
            const isFail = q.is_fail === true;
            return (
              <div
                key={q.autism_qs_id ?? q.question_number}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface2)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
                    Q{q.question_number}
                  </span>
                  <Badge tone={isFail ? 'warning' : 'success'}>
                    Answer: {q.selected_answer || '-'}
                  </Badge>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{q.question_text}</div>
                {q.example_text ? (
                  <p className="td-meta" style={{ marginBottom: 0 }}>{q.example_text}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
