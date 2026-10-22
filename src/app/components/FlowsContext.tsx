import { createContext, useContext, useMemo, useState } from 'react';
import { MOCK_FLOWS, type Flow } from './flowRegister';

// ─── the flows, where more than one page can see them ────────────────────────
//
// The automations used to live inside the Response Flows page, which meant two
// things: a flow you created disappeared the moment you navigated away, and no
// other page could answer "is there an automation for this yet". The second is
// what Configurations needs in order to stop recommending something you have
// already done.
//
// So they sit above the pages. Nothing else changes about how they are edited —
// the page still owns the builder, the drafts and the saving.

interface FlowsApi {
  flows: Flow[];
  setFlows: React.Dispatch<React.SetStateAction<Flow[]>>;
}

const Ctx = createContext<FlowsApi | null>(null);

export function FlowsProvider({ children }: { children: React.ReactNode }) {
  const [flows, setFlows] = useState<Flow[]>(MOCK_FLOWS);
  const value = useMemo(() => ({ flows, setFlows }), [flows]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFlows(): FlowsApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFlows must be used inside FlowsProvider');
  return ctx;
}
