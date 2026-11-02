import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import IncidentTriageSidebar from './IncidentTriageSidebar';
import { TRIAGE_INCIDENTS, type TriageIncident } from './triageTestData';
import { TABLE_SHELL, TABLE_HEAD, TABLE_TH, TABLE_BODY, TABLE_ROW, TABLE_TD } from './tableStyles';

// ─── Incidents (AI Triage) — test page ───────────────────────────────────────
//
// A standalone page for trying the new AI Analysis sidebar (wireframe option
// 6b plus the review fixes) without touching Incidents (A) or (B). Its own
// fixtures, its own sidebar; nothing here is shared state with the real list.

const VERDICT = {
  TruePositive: { label: 'True positive', cls: 'bg-red-50 text-red-700' },
  FalsePositive: { label: 'False positive', cls: 'bg-green-50 text-green-700' },
} as const;

const SEVERITY = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-800',
  Low: 'bg-blue-100 text-blue-700',
} as const;

export default function IncidentsTriageTest() {
  const [open, setOpen] = useState<TriageIncident | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-[#092E3F]">Incidents (AI Triage)</h1>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-amber-100 text-amber-800 text-xs">
          <FlaskConical className="w-3.5 h-3.5" /> Test
        </span>
      </div>
      <p className="text-sm text-[#092E3F]/60 mb-5">
        Three incidents for trying the new AI Analysis sidebar: a true positive below the containment threshold, a false
        positive below the auto-close threshold, and a true positive with long indicator lists.
      </p>

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
            {TRIAGE_INCIDENTS.map(inc => (
              <tr key={inc.id} onClick={() => setOpen(inc)} className={`${TABLE_ROW} cursor-pointer`}>
                <td className={`${TABLE_TD} tabular-nums`}>#{inc.number}</td>
                <td className={TABLE_TD}>
                  <p>{inc.title}</p>
                  <p className="text-xs text-[#092E3F]/50">{inc.entities[0].name}</p>
                </td>
                <td className={TABLE_TD}>
                  <span className={`px-2 py-0.5 rounded-[4px] text-xs ${SEVERITY[inc.severity]}`}>{inc.severity}</span>
                </td>
                <td className={TABLE_TD}>
                  <span className={`px-2 py-0.5 rounded-[4px] text-xs ${VERDICT[inc.verdict].cls}`}>{VERDICT[inc.verdict].label}</span>
                </td>
                <td className={`${TABLE_TD} tabular-nums`}>
                  {inc.confidence}%
                  {inc.confidence < inc.threshold && (
                    <span className="ml-1.5 text-xs text-amber-700">below {inc.threshold}%</span>
                  )}
                </td>
                <td className={`${TABLE_TD} text-[#092E3F]/60`}>{inc.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <IncidentTriageSidebar key={open.id} incident={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
