import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import IncidentTriageSidebar from './IncidentTriageSidebar';
import IncidentTriageSidebarV2 from './IncidentTriageSidebarV2';
import { TRIAGE_INCIDENTS } from './triageTestData';
import { REDESIGN_INCIDENTS } from './triageRedesignData';
import { TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_BODY, TABLE_ROW, TABLE_TD } from './tableStyles';

// ─── Incidents (AI Triage) — test page ───────────────────────────────────────
//
// A standalone page for trying AI Analysis sidebar designs without touching
// Incidents (A) or (B). Two variants, each with its own fixtures and sidebar:
//
//   a  wireframe option 6b plus the review fixes
//   b  the decision-first redesign, with no-analysis and failed-analysis cases

export type TriageVariant = 'a' | 'b';

const VERDICT = {
  TruePositive: { label: 'True positive', cls: 'bg-red-50 text-red-700' },
  FalsePositive: { label: 'False positive', cls: 'bg-green-50 text-green-700' },
  Undetermined: { label: 'Undetermined', cls: 'bg-gray-100 text-[#092E3F]' },
} as const;

const SEVERITY = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-700',
} as const;

/** One row shape for both variants' fixtures. */
interface Row {
  id: string;
  number: string;
  title: string;
  severity: keyof typeof SEVERITY;
  entity: string;
  created: string;
  /** Absent when the AI has not produced a verdict. */
  verdict?: keyof typeof VERDICT;
  confidence?: number;
  threshold?: number;
  state?: 'none' | 'error';
}

const ROWS: Record<TriageVariant, Row[]> = {
  a: TRIAGE_INCIDENTS.map(i => ({
    id: i.id, number: i.number, title: i.title, severity: i.severity, entity: i.entities[0].name, created: i.created,
    verdict: i.verdict, confidence: i.confidence, threshold: i.threshold,
  })),
  b: REDESIGN_INCIDENTS.map(i => ({
    id: i.id, number: i.number, title: i.title, severity: i.severity, entity: i.entities[0].name, created: i.created,
    ...(i.analysisState === 'done'
      ? { verdict: i.analysis.verdict, confidence: i.analysis.confidence, threshold: i.analysis.threshold }
      : { state: i.analysisState }),
  })),
};

const INTRO: Record<TriageVariant, string> = {
  a: 'Three incidents for trying the new AI Analysis sidebar: a true positive below the containment threshold, a false positive below the auto-close threshold, and a true positive with long indicator lists.',
  b: 'The decision-first incident panel. Five incidents: the three from (A), one not yet analysed whose evidence turns out incomplete, and one whose analysis failed.',
};

export default function IncidentsTriageTest({ variant = 'a' }: { variant?: TriageVariant }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openA = variant === 'a' ? TRIAGE_INCIDENTS.find(i => i.id === openId) : undefined;
  const openB = variant === 'b' ? REDESIGN_INCIDENTS.find(i => i.id === openId) : undefined;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-[#092E3F]">Incidents (AI Triage{variant === 'b' ? ' B' : ''})</h1>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-800 text-xs">
          <FlaskConical className="w-3.5 h-3.5" /> Test
        </span>
      </div>
      <p className="text-sm text-[#092E3F]/60 mb-5">{INTRO[variant]}</p>

      <div className={TABLE_SHELL}>
        <table className="w-full">
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TABLE_TH}>Incident</th>
              <th className={TABLE_TH}>Title</th>
              <th className={TABLE_TH}>Severity</th>
              <th className={TABLE_TH}>AI verdict</th>
              <th className={TABLE_TH}>Confidence</th>
              <th className={TABLE_TH}>Created</th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {ROWS[variant].map(r => (
              <tr key={r.id} onClick={() => setOpenId(r.id)} className={`${TABLE_ROW} cursor-pointer`}>
                <td className={`${TABLE_TD} tabular-nums`}>#{r.number}</td>
                <td className={`${TABLE_TD} max-w-[420px]`}>
                  <p className="truncate" title={r.title}>{r.title}</p>
                  <p className="text-xs text-[#092E3F]/50">{r.entity}</p>
                </td>
                <td className={TABLE_TD}>
                  <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY[r.severity]}`}>{r.severity}</span>
                </td>
                <td className={TABLE_TD}>
                  {r.verdict ? (
                    <span className={`px-2 py-0.5 rounded-[4px] text-xs ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
                  ) : (
                    <span className={`text-xs ${r.state === 'error' ? 'text-red-700' : 'text-[#092E3F]/50'}`}>
                      {r.state === 'error' ? 'Analysis failed' : 'Not analysed'}
                    </span>
                  )}
                </td>
                <td className={`${TABLE_TD} tabular-nums`}>
                  {r.confidence !== undefined ? (
                    <>
                      {r.confidence}%
                      {r.threshold !== undefined && r.confidence < r.threshold && (
                        <span className="ml-1.5 text-xs text-amber-700">below {r.threshold}%</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[#092E3F]/40">—</span>
                  )}
                </td>
                <td className={`${TABLE_TD} text-[#092E3F]/60 whitespace-nowrap`}>{r.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openA && <IncidentTriageSidebar key={openA.id} incident={openA} onClose={() => setOpenId(null)} />}
      {openB && <IncidentTriageSidebarV2 key={openB.id} incident={openB} onClose={() => setOpenId(null)} />}
    </div>
  );
}
