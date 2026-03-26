import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import {
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Activity,
  Settings,
  History,
  TestTube,
} from 'lucide-react';
import {
  getInterfaces,
  createInterface,
  updateInterface,
  deleteInterface,
  testConnection,
  InterfaceConfig,
  ProtocolType,
} from '../src/services/interfaceApi';
import { showSuccess } from '../src/services/api';

// Protocol Configuration Component
const ProtocolConfigForm: React.FC<{
  protocol: ProtocolType;
  config: any;
  onChange: (config: any) => void;
}> = ({ protocol, config, onChange }) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const handleChange = (field: string, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const inputClassName = `w-full px-3 py-2 border rounded-lg ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
  }`;

  const selectClassName = `w-full px-3 py-2 border rounded-lg ${
    isDark
      ? 'bg-gray-700 border-gray-600 text-gray-100'
      : 'bg-white border-gray-300 text-gray-900'
  }`;

  const labelClassName = `block text-sm font-medium mb-1 ${
    isDark ? 'text-gray-200' : 'text-gray-700'
  }`;

  switch (protocol) {
    case 'modbus_tcp':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {"Host Address"}
            </label>
            <input
              type="text"
              value={config.host || ''}
              onChange={(e) => handleChange('host', e.target.value)}
              placeholder="192.168.1.100"
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Port"}
            </label>
            <input
              type="number"
              value={config.port || 502}
              onChange={(e) => handleChange('port', parseInt(e.target.value))}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Timeout (ms)"}
            </label>
            <input
              type="number"
              value={config.timeout_ms || 5000}
              onChange={(e) => handleChange('timeout_ms', parseInt(e.target.value))}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Retry Count"}
            </label>
            <input
              type="number"
              value={config.retry_count || 3}
              onChange={(e) => handleChange('retry_count', parseInt(e.target.value))}
              className={inputClassName}
            />
          </div>
        </div>
      );
    case 'opcua':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClassName}>
              {"Endpoint URL"}
            </label>
            <input
              type="text"
              value={config.endpoint || ''}
              onChange={(e) => handleChange('endpoint', e.target.value)}
              placeholder="opc.tcp://localhost:4840"
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Security Mode"}
            </label>
            <select
              value={config.security_mode || 'None'}
              onChange={(e) => handleChange('security_mode', e.target.value)}
              className={selectClassName}
            >
              <option value="None">{"None"}</option>
              <option value="Sign">{"Sign"}</option>
              <option value="SignAndEncrypt">{"SignAndEncrypt"}</option>
            </select>
          </div>
          <div>
            <label className={labelClassName}>
              {"Timeout (ms)"}
            </label>
            <input
              type="number"
              value={config.timeout_ms || 10000}
              onChange={(e) => handleChange('timeout_ms', parseInt(e.target.value))}
              className={inputClassName}
            />
          </div>
        </div>
      );
    case 'mqtt':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClassName}>
              {"Broker Address"}
            </label>
            <input
              type="text"
              value={config.broker || ''}
              onChange={(e) => handleChange('broker', e.target.value)}
              placeholder="tcp://localhost:1883"
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Client ID"}
            </label>
            <input
              type="text"
              value={config.client_id || ''}
              onChange={(e) => handleChange('client_id', e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Keep Alive"}
            </label>
            <input
              type="number"
              value={config.keep_alive_interval || 60}
              onChange={(e) => handleChange('keep_alive_interval', parseInt(e.target.value))}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Username"}
            </label>
            <input
              type="text"
              value={config.username || ''}
              onChange={(e) => handleChange('username', e.target.value)}
              className={inputClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>
              {"Password"}
            </label>
            <input
              type="password"
              value={config.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              className={inputClassName}
            />
          </div>
        </div>
      );
    default:
      return null;
  }
};

// Main Component
export const CollectorInterfaces: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [interfaces, setInterfaces] = useState<InterfaceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInterface, setEditingInterface] = useState<InterfaceConfig | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<InterfaceConfig>>({
    name: '',
    protocol: 'modbus_tcp',
    enabled: true,
    connection_config: {},
    data_points: [],
  });

  // Load interface list
  const loadInterfaces = async () => {
    if (!selectedCollector) return;
    setLoading(true);
    try {
      const data = await getInterfaces(selectedCollector);
      setInterfaces(data);
    } catch (error) {
      console.error('Failed to load interfaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInterfaces();
  }, [selectedCollector]);

  // Open create modal
  const handleCreate = () => {
    setEditingInterface(null);
    setFormData({
      name: '',
      protocol: 'modbus_tcp',
      enabled: true,
      connection_config: {},
      data_points: [],
    });
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEdit = (iface: InterfaceConfig) => {
    setEditingInterface(iface);
    setFormData({ ...iface });
    setIsModalOpen(true);
  };

  // Save interface
  const handleSave = async () => {
    if (!selectedCollector || !formData.name) {
      showError("Please fill in complete information");
      return;
    }

    if (editingInterface?.id) {
      const result = await updateInterface(
        selectedCollector,
        editingInterface.id,
        formData
      );
      if (result) {
        loadInterfaces();
        setIsModalOpen(false);
      }
    } else {
      const result = await createInterface(
        selectedCollector,
        formData as Omit<InterfaceConfig, 'id'>
      );
      if (result) {
        loadInterfaces();
        setIsModalOpen(false);
      }
    }
  };

  // Delete interface
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this interface?")) return;
    if (!selectedCollector) return;

    const success = await deleteInterface(selectedCollector, id);
    if (success) {
      loadInterfaces();
    }
  };

  // Test connection
  const handleTest = async (id: string) => {
    if (!selectedCollector) return;
    const result = await testConnection(selectedCollector, id);
    if (result.success) {
      showSuccess(result.message);
    } else {
      showError(result.message);
    }
  };

  // Toggle expand state
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Protocol tag colors
  const getProtocolColor = (protocol: ProtocolType) => {
    switch (protocol) {
      case 'modbus_tcp':
      case 'modbus_rtu':
        return isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800';
      case 'opcua':
        return isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-100 text-purple-800';
      case 'mqtt':
        return isDark ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800';
      default:
        return isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800';
    }
  };

  const tableHeaderClass = isDark
    ? 'bg-gray-700 text-gray-200'
    : 'bg-gray-50 text-gray-700';

  const tableCellClass = isDark
    ? 'border-gray-700 text-gray-200'
    : 'border-gray-200 text-gray-700';

  const preClass = isDark
    ? 'bg-gray-700 text-gray-100'
    : 'bg-gray-100 text-gray-900';

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            {t('collectorInterfaces.title')}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('collectorInterfaces.subtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedCollector}
            onChange={(e) => setSelectedCollector(e.target.value)}
            className={`px-4 py-2 border rounded-lg ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-gray-100'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            <option value="">{"Select Collector"}</option>
            <option value="collector-1">{"Collector 1"}</option>
            <option value="collector-2">{"Collector 2"}</option>
          </select>
          <button
            onClick={loadInterfaces}
            disabled={loading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isDark
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedCollector}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {"Create Interface"}
          </button>
        </div>
      </div>

      {/* Interface List */}
      <div className="space-y-4">
        {interfaces.length === 0 ? (
          <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {selectedCollector
              ? "No interface configurations"
              : "Please select a collector first"}
          </div>
        ) : (
          interfaces.map((iface) => (
            <div
              key={iface.id}
              className={`border rounded-lg overflow-hidden ${
                isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}
            >
              {/* Interface Header */}
              <div
                className={`p-4 flex items-center justify-between cursor-pointer ${
                  isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleExpand(iface.id!)}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getProtocolColor(
                      iface.protocol
                    )}`}
                  >
                    {iface.protocol}
                  </span>
                  <span className={`font-medium ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    {iface.name}
                  </span>
                  {iface.enabled ? (
                    <span className="flex items-center gap-1 text-green-500 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      {"Enabled"}
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <XCircle className="w-4 h-4" />
                      {"Disabled"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTest(iface.id!);
                    }}
                    className={`p-2 rounded ${
                      isDark
                        ? 'text-gray-300 hover:bg-gray-600'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={"Test Connection"}
                  >
                    <TestTube className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(iface);
                    }}
                    className={`p-2 rounded ${
                      isDark
                        ? 'text-blue-400 hover:bg-blue-900/30'
                        : 'text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(iface.id!);
                    }}
                    className={`p-2 rounded ${
                      isDark
                        ? 'text-red-400 hover:bg-red-900/30'
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedId === iface.id ? (
                    <ChevronUp className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                  ) : (
                    <ChevronDown className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === iface.id && (
                <div className={`px-4 pb-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="pt-4 space-y-4">
                    {/* Connection Configuration */}
                    <div>
                      <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <Settings className="w-4 h-4" />
                        {"Connection Configuration"}
                      </h4>
                      <pre className={`text-xs p-3 rounded overflow-auto ${preClass}`}>
                        {JSON.stringify(iface.connection_config, null, 2)}
                      </pre>
                    </div>

                    {/* Data Points */}
                    <div>
                      <h4 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                        <Activity className="w-4 h-4" />
                        {"Data Points"} ({iface.data_points?.length || 0})
                      </h4>
                      {iface.data_points && iface.data_points.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className={tableHeaderClass}>
                              <tr>
                                <th className="px-3 py-2 text-left">
                                  {"Name"}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {"Address"}
                                </th>
                                <th className="px-3 py-2 text-left">
                                  {"Type"}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {iface.data_points.slice(0, 5).map((point, idx) => (
                                <tr key={idx} className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                  <td className={`px-3 py-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                    {point.name}
                                  </td>
                                  <td className={`px-3 py-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                    {point.address}
                                  </td>
                                  <td className={`px-3 py-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                    {point.data_type}
                                  </td>
                                </tr>
                              ))}
                              {iface.data_points.length > 5 && (
                                <tr>
                                  <td
                                    colSpan={3}
                                    className={`px-3 py-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                                  >
                                    {`And ${iface.data_points.length - 5} more data points...`}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {"No data points configured"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className={`w-full max-w-2xl max-h-[90vh] overflow-auto rounded-lg shadow-xl ${
              isDark ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <div className={`p-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {editingInterface
                  ? "Edit Interface"
                  : "Create Interface"}
              </h2>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {"Interface Name"}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    placeholder={"e.g., Line1-PLC"}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {"Protocol Type"}
                  </label>
                  <select
                    value={formData.protocol}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        protocol: e.target.value as ProtocolType,
                        connection_config: {},
                      })
                    }
                    className={`w-full px-3 py-2 border rounded-lg ${
                      isDark
                        ? 'bg-gray-700 border-gray-600 text-gray-100'
                        : 'bg-white border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value="modbus_tcp">Modbus TCP</option>
                    <option value="modbus_rtu">Modbus RTU</option>
                    <option value="opcua">OPC UA</option>
                    <option value="mqtt">MQTT</option>
                  </select>
                </div>
              </div>

              {/* Enable Status */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  {"Enable this interface"}
                </label>
              </div>

              {/* Protocol Configuration */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                  {"Connection Configuration"}
                </label>
                <ProtocolConfigForm
                  protocol={formData.protocol || 'modbus_tcp'}
                  config={formData.connection_config || {}}
                  onChange={(config) => setFormData({ ...formData, connection_config: config })}
                />
              </div>
            </div>
            <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setIsModalOpen(false)}
                className={`px-4 py-2 border rounded-lg ${
                  isDark
                    ? 'border-gray-600 hover:bg-gray-700 text-gray-200'
                    : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                }`}
              >
                {"Cancel"}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {"Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for showing error
function showError(message: string) {
  // This would typically use your toast/notification system
  console.error(message);
  alert(message);
}
