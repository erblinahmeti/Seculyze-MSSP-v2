import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import IncidentTriageSidebar from './IncidentTriageSidebar';
import IncidentTriageSidebarV2 from './IncidentTriageSidebarV2';
import { TRIAGE_INCIDENTS } from './triageTestData';
import { REDESIGN_INCIDENTS } from './triageRedesignData';
import { SEVERITY_BADGE } from './severity';
import { useWorkspace } from './WorkspaceContext';
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

// Same teal scale as the Incidents (A) table.
const SEVERITY = SEVERITY_BADGE;

/** One row shape for both variants' fixtures. */
interface Row {
  id: string;
  /** The tenant the incident belongs to (variant b). */
  tenant?: string;
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
  // An incident can hold several alerts; the list shows the first alert's
  // verdict, as the panel opens on it.
  b: REDESIGN_INCIDENTS.map(i => {
    const al = i.alerts[0];
    return {
      id: i.id, number: i.number, title: i.title, severity: i.severity, created: i.created, tenant: i.client,
      entity: i.entities[0].name + (i.alerts.length > 1 ? ` · ${i.alerts.length} alerts` : ''),
      ...(al.analysisState === 'done'
        ? { verdict: al.analysis.verdict, confidence: al.analysis.confidence, threshold: al.analysis.threshold }
        : { state: al.analysisState }),
    };
  }),
};

const INTRO: Record<TriageVariant, string> = {
  a: 'Three incidents for trying the new AI Analysis sidebar: a true positive below the containment threshold, a false positive below the auto-close threshold, and a true positive with long indicator lists.',
  b: 'The decision-first incident panel, with mock data. Each incident lists its alerts, and the AI triages one alert at a time: what you need to know, what you need to do, then the evidence. #14310 has three alerts (one analysed, one failed, one not analysed) and #14352 two that are not analysed yet — use Analyze all. Status and severity changes on #14371 fail to save, to show the error state.',
};

export default function IncidentsTriageTest({ variant = 'a' }: { variant?: TriageVariant }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Variant b follows the workspace: one tenant's workspace lists only its incidents;
  // the all-tenants (MSSP) view lists every tenant's and adds a Tenant column.
  const workspace = useWorkspace();
  const scoped = variant === 'b';
  const rows = scoped ? ROWS.b.filter(r => !r.tenant || workspace.inScope.includes(r.tenant)) : ROWS[variant];
  const showTenant = scoped && !workspace.single;
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
              {showTenant && <th className={TABLE_TH}>Tenant</th>}
              <th className={TABLE_TH}>Title</th>
              <th className={TABLE_TH}>Severity</th>
              <th className={TABLE_TH}>AI verdict</th>
              <th className={TABLE_TH}>Confidence</th>
              <th className={TABLE_TH}>Created</th>
            </tr>
          </thead>
          <tbody className={TABLE_BODY}>
            {rows.length === 0 && (
              <tr>
                <td colSpan={showTenant ? 7 : 6} className={`${TABLE_TD} text-center text-[#092E3F]/55`}>
                  No test incidents for {workspace.label}. Switch to {scoped ? 'Nike, Adidas or Puma, or all clients' : 'all clients'} to see some.
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} onClick={() => setOpenId(r.id)} className={`${TABLE_ROW} cursor-pointer`}>
                <td className={`${TABLE_TD} tabular-nums`}>#{r.number}</td>
                {showTenant && <td className={`${TABLE_TD} whitespace-nowrap`}>{r.tenant}</td>}
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
