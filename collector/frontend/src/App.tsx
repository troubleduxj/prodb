/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Protocols from './pages/Protocols';
import Configuration from './pages/Configuration';
import Security from './pages/Security';
import Logs from './pages/Logs';
import Interfaces from './pages/Interfaces';
import ConfigStatus from './pages/ConfigStatus';
import EdgeAlerts from './pages/EdgeAlerts';
import Tasks from './pages/Tasks';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/protocols" element={<Protocols />} />
          <Route path="/interfaces" element={<Interfaces />} />
          <Route path="/config" element={<Configuration />} />
          <Route path="/config-status" element={<ConfigStatus />} />
          <Route path="/alerts" element={<EdgeAlerts />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/security" element={<Security />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
