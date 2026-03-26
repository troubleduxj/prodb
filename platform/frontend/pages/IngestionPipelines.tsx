import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Filter, ArrowRight, Trash2, PlusCircle, PlayCircle, X, Save, ArrowLeft, Edit } from 'lucide-react';

interface PipelineStep {
  id: string;
  type: 'filter' | 'enrich' | 'mask' | 'transform';
  name: string;
  config?: Record<string, string>;
}

interface Pipeline {
  id: string;
  name: string;
  source: string;
  status: 'Running' | 'Stopped';
  hitsPerSec: number;
  steps: PipelineStep[];
}

const MOCK_PIPELINES: Pipeline[] = [
  {
    id: '1',
    name: 'Pre-process MQTT Meters 1',
    source: 'Factory A Gateway',
    status: 'Running',
    hitsPerSec: 1250,
    steps: [
      { id: 's1', type: 'filter', name: 'Filter Nulls' },
      { id: 's2', type: 'enrich', name: 'Enrich Location' },
      { id: 's3', type: 'mask', name: 'Mask Sensitive' }
    ]
  },
  {
    id: '2',
    name: 'Log Sanitization Pipeline',
    source: 'Web Servers',
    status: 'Running',
    hitsPerSec: 850,
    steps: [
      { id: 's4', type: 'filter', name: 'Remove Debug Logs' },
      { id: 's5', type: 'mask', name: 'Mask IP Addresses' }
    ]
  }
];

export const IngestionPipelines: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [pipelines, setPipelines] = useState<Pipeline[]>(MOCK_PIPELINES);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineSource, setNewPipelineSource] = useState('');

  // Editor View State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const handleCreatePipeline = () => {
    if (!newPipelineName.trim() || !newPipelineSource.trim()) return;

    const newPipeline: Pipeline = {
      id: Date.now().toString(),
      name: newPipelineName,
      source: newPipelineSource,
      status: 'Stopped',
      hitsPerSec: 0,
      steps: []
    };

    setPipelines([...pipelines, newPipeline]);
    setIsModalOpen(false);
    setNewPipelineName('');
    setNewPipelineSource('');
    
    // Open editor for the new pipeline
    setEditingPipelineId(newPipeline.id);
    setIsEditorOpen(true);
  };

  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPipelines(pipelines.map(p => {
      if (p.id === id) {
        return { ...p, status: p.status === 'Running' ? 'Stopped' : 'Running' };
      }
      return p;
    }));
  };

  const handleDeletePipeline = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('ingestion.pipelines.confirmDelete', 'Are you sure you want to delete this pipeline?'))) {
      setPipelines(pipelines.filter(p => p.id !== id));
      if (editingPipelineId === id) {
        setIsEditorOpen(false);
        setEditingPipelineId(null);
      }
    }
  };

  const handleAddStep = (type: PipelineStep['type']) => {
    if (!editingPipelineId) return;
    const newStepId = `s_${Date.now()}`;
    setPipelines(pipelines.map(p => {
      if (p.id === editingPipelineId) {
        const newStep: PipelineStep = {
          id: newStepId,
          type,
          name: type === 'filter' ? t('ingestion.pipelines.newFilter', 'New Filter') : type === 'enrich' ? t('ingestion.pipelines.newEnrichment', 'New Enrichment') : type === 'mask' ? t('ingestion.pipelines.newMask', 'New Mask') : t('ingestion.pipelines.newTransform', 'New Transform'),
          config: {}
        };
        return { ...p, steps: [...p.steps, newStep] };
      }
      return p;
    }));
    setSelectedStepId(newStepId);
  };

  const handleRemoveStep = (stepId: string) => {
    if (!editingPipelineId) return;
    setPipelines(pipelines.map(p => {
      if (p.id === editingPipelineId) {
        return { ...p, steps: p.steps.filter(s => s.id !== stepId) };
      }
      return p;
    }));
  };

  const handleUpdateStepConfig = (stepId: string, key: string, value: string) => {
    if (!editingPipelineId) return;
    setPipelines(pipelines.map(p => {
      if (p.id === editingPipelineId) {
        return {
          ...p,
          steps: p.steps.map(s => {
            if (s.id === stepId) {
              return { ...s, config: { ...s.config, [key]: value } };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const handleEditPipeline = (id: string) => {
    setEditingPipelineId(id);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingPipelineId(null);
  };

  const editingPipeline = pipelines.find(p => p.id === editingPipelineId);

  // Render Editor View
  if (isEditorOpen && editingPipeline) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleCloseEditor}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold flex items-center gap-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                {t('ingestion.pipelines.editPipeline', 'Edit Pipeline')}: <span className="text-blue-400">{editingPipeline.name}</span>
              </h1>
              <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.source', 'Source')}: <span className={`font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{editingPipeline.source}</span></p>
            </div>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={handleCloseEditor}
               className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
             >
               {t('common.cancel', 'Cancel')}
             </button>
             <button 
               onClick={handleCloseEditor}
               className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
             >
               <Save className="w-4 h-4" /> {t('ingestion.pipelines.saveConfiguration', 'Save Configuration')}
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Steps Palette */}
          <div className={`rounded-xl p-5 h-fit ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <h4 className={`text-xs font-bold uppercase mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.availableProcessors', 'Available Processors')}</h4>
            <div className="space-y-3">
              <button onClick={() => handleAddStep('filter')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left group ${isDark ? 'bg-gray-900/50 hover:bg-gray-700 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 border'}`}>
                <div className="p-2 bg-yellow-900/30 text-yellow-500 rounded group-hover:bg-yellow-900/50"><Filter className="w-4 h-4" /></div>
                <div>
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.pipelines.filter', 'Filter')}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.pipelines.removeUnwantedData', 'Remove unwanted data')}</div>
                </div>
                <PlusCircle className={`w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              </button>
              <button onClick={() => handleAddStep('enrich')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left group ${isDark ? 'bg-gray-900/50 hover:bg-gray-700 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 border'}`}>
                <div className="p-2 bg-blue-900/30 text-blue-400 rounded group-hover:bg-blue-900/50"><PlusCircle className="w-4 h-4" /></div>
                <div>
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.pipelines.enrich', 'Enrich')}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.pipelines.addContextData', 'Add context data')}</div>
                </div>
                <PlusCircle className={`w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              </button>
              <button onClick={() => handleAddStep('mask')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left group ${isDark ? 'bg-gray-900/50 hover:bg-gray-700 border-gray-700' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 border'}`}>
                <div className="p-2 bg-purple-900/30 text-purple-400 rounded group-hover:bg-purple-900/50"><X className="w-4 h-4" /></div>
                <div>
                  <div className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{t('ingestion.pipelines.mask', 'Mask')}</div>
                  <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.pipelines.hideSensitiveInfo', 'Hide sensitive info')}</div>
                </div>
                <PlusCircle className={`w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
              </button>
            </div>
          </div>

          {/* Pipeline Flow Visualization */}
          <div className={`col-span-2 rounded-xl p-8 min-h-[500px] flex gap-6 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <div className="flex-1 flex flex-col items-center">
            <div className="w-full max-w-xl space-y-6">
              {/* Source Node */}
              <div className="flex justify-center">
                <div className={`px-6 py-3 rounded-full text-sm font-mono shadow-lg ${isDark ? 'bg-gray-900 border-gray-600 text-gray-300 border' : 'bg-gray-100 border-gray-300 text-gray-700 border'}`}>
                  {t('ingestion.pipelines.source', 'Source')}: {editingPipeline.source}
                </div>
              </div>
              
              <div className="flex justify-center"><ArrowRight className={`w-5 h-5 rotate-90 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} /></div>

              {/* Steps */}
              {editingPipeline.steps.length === 0 ? (
                <div className={`border-2 border-dashed rounded-xl p-12 text-center ${isDark ? 'border-gray-700 bg-gray-900/30' : 'border-gray-300 bg-gray-50'}`}>
                  <p className={isDark ? 'text-gray-400 font-medium' : 'text-gray-600 font-medium'}>{t('ingestion.pipelines.pipelineEmpty', 'Pipeline is empty')}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t('ingestion.pipelines.addProcessingSteps', 'Add processing steps from the left panel to define your data flow.')}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {editingPipeline.steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <div 
                        onClick={() => setSelectedStepId(step.id)}
                        className={`border rounded-xl p-4 flex items-center justify-between group cursor-pointer transition-all shadow-md hover:shadow-lg ${
                          selectedStepId === step.id ? 'border-blue-500 ring-1 ring-blue-500/50' : (isDark ? 'border-gray-700 hover:border-blue-500/30 bg-gray-900' : 'border-gray-200 hover:border-blue-500/30 bg-gray-50')
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-lg ${
                            step.type === 'filter' ? 'bg-yellow-900/20 text-yellow-500' :
                            step.type === 'enrich' ? 'bg-blue-900/20 text-blue-400' :
                            'bg-purple-900/20 text-purple-400'
                          }`}>
                            {step.type === 'filter' ? <Filter className="w-5 h-5" /> : 
                             step.type === 'enrich' ? <PlusCircle className="w-5 h-5" /> : 
                             <X className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{step.name}</div>
                            <div className={`text-xs font-mono mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>ID: {step.id}</div>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveStep(step.id); if(selectedStepId === step.id) setSelectedStepId(null); }}
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-600 hover:text-red-400 hover:bg-gray-800' : 'text-gray-400 hover:text-red-500 hover:bg-gray-200'}`}
                          title={t('ingestion.pipelines.removeStep', 'Remove Step')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {idx < editingPipeline.steps.length - 1 && (
                        <div className="flex justify-center"><ArrowRight className={`w-5 h-5 rotate-90 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} /></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {editingPipeline.steps.length > 0 && (
                <>
                  <div className="flex justify-center"><ArrowRight className={`w-5 h-5 rotate-90 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} /></div>
                  {/* Sink Node */}
                  <div className="flex justify-center">
                    <div className={`px-6 py-3 rounded-full text-sm font-mono shadow-lg ${isDark ? 'bg-green-900/20 border-green-700/50 text-green-400 border' : 'bg-green-50 border-green-200 text-green-700 border'}`}>
                      {t('ingestion.pipelines.sinkTDengineDatabase', 'Sink: TDengine Database')}
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>

            {/* Step Configuration Panel */}
            {selectedStepId && (
              <div className={`w-80 border-l p-6 -my-8 -mr-8 animate-in slide-in-from-right duration-200 ${isDark ? 'bg-gray-900/80 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-sm font-bold uppercase ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.pipelines.stepConfiguration', 'Step Configuration')}</h3>
                  <button onClick={() => setSelectedStepId(null)} className={isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}><X className="w-4 h-4"/></button>
                </div>
                
                {(() => {
                  const step = editingPipeline.steps.find(s => s.id === selectedStepId);
                  if (!step) return null;

                  return (
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('common.stepName', 'Step Name')}</label>
                        <input 
                          type="text" 
                          value={step.name}
                          readOnly
                          className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-300 text-gray-700'}`}
                        />
                      </div>

                      {step.type === 'filter' && (
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.filterConditionSQL', 'Filter Condition (SQL)')}</label>
                          <textarea 
                            value={step.config?.condition || ''}
                            onChange={(e) => handleUpdateStepConfig(step.id, 'condition', e.target.value)}
                            placeholder="e.g., temperature > 100 AND status = 'error'"
                            className={`w-full border rounded px-3 py-2 text-sm focus:outline-none min-h-[100px] font-mono ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                          />
                        </div>
                      )}

                      {step.type === 'enrich' && (
                        <>
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.lookupSource', 'Lookup Source')}</label>
                            <select 
                              value={step.config?.source || ''}
                              onChange={(e) => handleUpdateStepConfig(step.id, 'source', e.target.value)}
                              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                            >
                              <option value="">{t('common.selectSource', 'Select source...')}</option>
                              <option value="device_metadata">{t('ingestion.pipelines.deviceMetadataTable', 'Device Metadata Table')}</option>
                              <option value="geo_ip">{t('ingestion.pipelines.geoIPDatabase', 'GeoIP Database')}</option>
                            </select>
                          </div>
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.targetField', 'Target Field')}</label>
                            <input 
                              type="text" 
                              value={step.config?.targetField || ''}
                              onChange={(e) => handleUpdateStepConfig(step.id, 'targetField', e.target.value)}
                              placeholder="e.g., location_info"
                              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                            />
                          </div>
                        </>
                      )}

                      {step.type === 'mask' && (
                        <>
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.fieldToMask', 'Field to Mask')}</label>
                            <input 
                              type="text" 
                              value={step.config?.field || ''}
                              onChange={(e) => handleUpdateStepConfig(step.id, 'field', e.target.value)}
                              placeholder="e.g., user_email"
                              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.maskingMethod', 'Masking Method')}</label>
                            <select 
                              value={step.config?.method || 'redact'}
                              onChange={(e) => handleUpdateStepConfig(step.id, 'method', e.target.value)}
                              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200 focus:border-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'}`}
                            >
                              <option value="redact">{t('ingestion.pipelines.fullRedaction', 'Full Redaction (***)')}</option>
                              <option value="partial">{t('ingestion.pipelines.partialMask', 'Partial Mask (138****0000)')}</option>
                              <option value="hash">{t('ingestion.pipelines.hash', 'Hash (SHA-256)')}</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render List View
  return (
    <div className="space-y-6 relative">
       <div className="flex items-center justify-between">
        <div>
           <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.pipelines.processingPipelines', 'Processing Pipelines')}</h1>
           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.defineETLRules', 'Define ETL rules to clean, transform, and enrich data before storage.')}</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center shadow-lg shadow-blue-900/20"
        >
             <PlusCircle className="w-4 h-4 mr-2" /> {t('ingestion.pipelines.newPipeline', 'New Pipeline')}
        </button>
      </div>

      <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
          <div className={`grid grid-cols-12 gap-4 p-4 text-xs font-medium uppercase ${isDark ? 'border-b border-gray-700 bg-gray-700/30 text-gray-400' : 'border-b border-gray-200 bg-gray-50 text-gray-600'}`}>
               <div className="col-span-3">{t('ingestion.pipelines.pipelineName', 'Pipeline Name')}</div>
               <div className="col-span-4">{t('common.steps', 'Steps')}</div>
               <div className="col-span-2 text-center">{t('common.status', 'Status')}</div>
               <div className="col-span-2 text-center">{t('ingestion.pipelines.hitsPerSec', 'Hits/sec')}</div>
               <div className="col-span-1 text-right">{t('common.actions', 'Actions')}</div>
          </div>
          
          {pipelines.map(pipeline => (
            <div 
              key={pipeline.id} 
              className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors border-b last:border-0 ${isDark ? 'hover:bg-gray-700/20 border-gray-700/50' : 'hover:bg-gray-50 border-gray-200/50'}`}
            >
               <div className="col-span-3">
                   <h3 className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{pipeline.name}</h3>
                   <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{t('ingestion.pipelines.appliedTo', 'Applied to')}: {pipeline.source}</p>
               </div>
               <div className="col-span-4 flex items-center space-x-2 overflow-x-auto no-scrollbar">
                   {pipeline.steps.length > 0 ? (
                     pipeline.steps.map((step, index) => (
                       <React.Fragment key={step.id}>
                         <div className={`px-2 py-1 rounded text-xs flex items-center whitespace-nowrap border ${
                           step.type === 'filter' ? 'bg-yellow-900/30 border-yellow-700/50 text-yellow-500' :
                           step.type === 'enrich' ? 'bg-blue-900/30 border-blue-700/50 text-blue-400' :
                           step.type === 'mask' ? 'bg-purple-900/30 border-purple-700/50 text-purple-400' :
                           (isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-700')
                         }`}>
                            {step.type === 'filter' && <Filter className="w-3 h-3 mr-1" />}
                            {step.name}
                         </div>
                         {index < pipeline.steps.length - 1 && <ArrowRight className={`w-3 h-3 shrink-0 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />}
                       </React.Fragment>
                     ))
                   ) : (
                     <span className={`text-xs italic ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>{t('ingestion.pipelines.noStepsDefined', 'No steps defined')}</span>
                   )}
               </div>
               <div className="col-span-2 text-center">
                   <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                     pipeline.status === 'Running' ? 'bg-green-500/10 text-green-400' : (isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-700')
                   }`}>
                      {pipeline.status}
                   </span>
               </div>
               <div className={`col-span-2 text-center font-mono text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                   {pipeline.status === 'Running' ? (Math.random() * 2000).toFixed(0) : '-'}
               </div>
               <div className="col-span-1 flex justify-end space-x-2">
                   <button 
                     onClick={() => handleEditPipeline(pipeline.id)}
                     className={`p-1 rounded hover:bg-gray-700 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                     title={t('common.edit', 'Edit Pipeline')}
                   >
                     <Edit className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={(e) => handleDeletePipeline(pipeline.id, e)}
                     className={`p-1 rounded hover:bg-gray-700 ${isDark ? 'text-gray-500 hover:text-red-400' : 'text-gray-500 hover:text-red-500 hover:bg-gray-200'}`}
                     title={t('common.delete', 'Delete Pipeline')}
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={(e) => handleToggleStatus(pipeline.id, e)}
                     className={`p-1 rounded hover:bg-gray-700 ${pipeline.status === 'Running' ? 'text-green-400' : (isDark ? 'text-gray-500 hover:text-blue-400' : 'text-gray-500 hover:text-blue-500')}`}
                     title={pipeline.status === 'Running' ? t('common.stop', 'Stop Pipeline') : t('common.start', 'Start Pipeline')}
                   >
                     <PlayCircle className="w-4 h-4" />
                   </button>
               </div>
            </div>
          ))}
          
          {pipelines.length === 0 && (
            <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {t('ingestion.pipelines.noPipelinesCreated', 'No pipelines created yet. Click "New Pipeline" to get started.')}
            </div>
          )}
      </div>
      
      {/* Create Pipeline Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`rounded-xl w-full max-w-md shadow-2xl flex flex-col ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
            <div className={`p-5 flex justify-between items-center rounded-t-xl ${isDark ? 'border-b border-gray-700 bg-gray-900/50' : 'border-b border-gray-200 bg-gray-50'}`}>
              <div>
                <h2 className={`text-lg font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('ingestion.pipelines.createNewPipeline', 'Create New Pipeline')}</h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.defineNewDataFlow', 'Define a new data processing flow')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className={isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.pipelineName', 'Pipeline Name')}</label>
                <input 
                  type="text" 
                  value={newPipelineName}
                  onChange={(e) => setNewPipelineName(e.target.value)}
                  placeholder={t('ingestion.pipelines.iotSensorDataProcessing', 'e.g., IoT Sensor Data Processing')}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${isDark ? 'bg-gray-950 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 uppercase ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('ingestion.pipelines.dataSource', 'Data Source')}</label>
                <select 
                  value={newPipelineSource}
                  onChange={(e) => setNewPipelineSource(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${isDark ? 'bg-gray-950 border-gray-700 text-gray-200' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="" disabled>{t('ingestion.pipelines.selectDataSource', 'Select a data source')}</option>
                  <option value="mqtt_stream_factory_a">mqtt_stream_factory_a</option>
                  <option value="http_logs_webserver">http_logs_webserver</option>
                  <option value="agent_metrics_prod">agent_metrics_prod</option>
                  <option value="kafka_orders_topic">kafka_orders_topic</option>
                  <option value="syslog_firewall_main">syslog_firewall_main</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button 
                  onClick={handleCreatePipeline}
                  disabled={!newPipelineName.trim() || !newPipelineSource.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> {t('ingestion.pipelines.createPipeline', 'Create Pipeline')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Rule Configuration Interface - Removed in favor of separate editor view */}
    </div>
  );
};
