import { useState } from 'react';
import { Toaster } from 'sonner@2.0.3';
import Sidebar from './components/Sidebar';
import BorderToggle from './components/BorderToggle';
import Dashboard from './components/Dashboard';
import Incidents from './components/Incidents';
import IncidentsBackup from './components/IncidentsBackup';
import Calibrate from './components/Calibrate';
import NoiseReduction from './components/NoiseReduction';
import AlertRules from './components/AlertRules';
import Policies from './components/Policies';
import Playbooks from './components/Playbooks';
import DataCollection from './components/DataCollection';
import IngestionBudget from './components/IngestionBudget';
import IngestionAnomalies from './components/IngestionAnomalies';
import IngestionAnomaliesV2 from './components/IngestionAnomaliesV2';
import Reports from './components/Reports';
import Clients from './components/Clients';
import ClientRegistry from './components/ClientRegistry';
import Workflows from './components/Workflows';
import AutomatedReporting from './components/AutomatedReporting';
import ResponseFlows from './components/ResponseFlows';
import ResponseFlowsLoFi from './components/ResponseFlowsLoFi';
import Settings from './components/Settings';
import HelpCenter from './components/HelpCenter';
import Notifications from './components/Notifications';

function App() {
  const [activePage, setActivePage] = useState('dashboard');

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      // Distinct keys, so React remounts instead of reusing the instance: each
      // variant must start from a clean slate rather than inherit actions the
      // facilitator ran on the other one.
      case 'incidents':
        return <Incidents key="incidents-a" variant="stacked" />;
      // Same page, second action-column design, so both can be put in front of
      // users without maintaining a forked copy.
      case 'incidents-b':
        return <Incidents key="incidents-b" variant="run-all" />;
      case 'incidents-backup':
        return <IncidentsBackup />;
      case 'notifications':
        return <Notifications />;
      case 'calibrate-overview':
        return <Calibrate />;
      case 'noise-reduction':
        return <NoiseReduction />;
      case 'alert-rules':
        return <AlertRules />;
      case 'data-collection':
        return <DataCollection />;
      case 'ingestion-anomalies':
        return <IngestionAnomalies />;
      case 'ingestion-anomalies-v2':
        return <IngestionAnomaliesV2 />;
      case 'ingestion-budget':
        return <IngestionBudget />;
      case 'client-registry':
        return <ClientRegistry />;
      case 'onboard-client':
        return <Workflows />;
      case 'automated-reporting':
        return <AutomatedReporting />;
      case 'response-flows':
        return <ResponseFlows />;
      case 'response-flows-lofi':
        return <ResponseFlowsLoFi />;
      case 'settings':
        return <Settings />;
      case 'help-center':
        return <HelpCenter />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #2A96A8',
            color: '#092E3F',
          },
          className: 'toast',
          duration: 3000,
        }}
      />
      <Sidebar activeItem={activePage} onNavigate={setActivePage} />
      {renderPage()}
      {/* Facilitator control for the borders A/B; see globals.css. */}
      <BorderToggle />
    </div>
  );
}

export default App;