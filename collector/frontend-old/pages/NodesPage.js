import { html } from 'https://esm.sh/htm/preact';

import { useState, useEffect } from 'https://esm.sh/preact/hooks';

const interfaceTypes = {
    'OPC DA': { server: 'string', user: 'string', pass: 'password' },
    'OPC UA': { endpoint: 'string', securityPolicy: ['None', 'Basic128Rsa15', 'Basic256'] },
    'Modbus': { host: 'string', port: 'number', slaveId: 'number' },
    'MQTT': { broker: 'string', topic: 'string', user: 'string', pass: 'password' },
};

const NodesPage = () => {
    const [interfaceType, setInterfaceType] = useState('OPC DA');
    const [formData, setFormData] = useState({});
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        const path = window.location.pathname;
        const parts = path.split('/');
        const id = parts[parts.length - 1];

        if (id === 'new') {
            setIsNew(true);
        } else if (id) {
            setIsNew(false);
            // 在实际应用中，这里会根据 id 从服务器获取数据
            const mockData = {
                name: 'Existing OPC DA Server',
                key: 'secret-key-123',
                type: 'OPC DA',
                server: 'localhost',
                user: 'admin',
            };
            setInterfaceType(mockData.type);
            setFormData(mockData);
        }
    }, []);

    const handleTypeChange = (e) => {
        setInterfaceType(e.target.value);
        setFormData({ ...formData, type: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const data = new FormData(e.target);
        console.log('Form submitted:', Object.fromEntries(data.entries()));
        // 在这里添加保存逻辑
    };

    const renderSpecificParams = () => {
        const params = interfaceTypes[interfaceType];
        if (!params) return null;

        return Object.entries(params).map(([key, value]) => {
            if (Array.isArray(value)) {
                return html`
                    <label for=${key}>${key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <select id=${key} name=${key} class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                        ${value.map(opt => html`<option value=${opt}>${opt}</option>`)}
                    </select>
                `;
            }
            return html`
                <label for=${key}>${key.charAt(0).toUpperCase() + key.slice(1)}</label>
                <input type=${value} id=${key} name=${key} class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />
            `;
        });
    };

    return html`
        <div class="p-6 max-w-screen-xl mx-auto">
            <h1>${isNew ? 'Create' : 'Edit'} Interface</h1>
            <form onSubmit=${handleSubmit}>
                <h2>General Parameters</h2>
                <label for="name">Interface Name</label>
                <input type="text" id="name" name="name" value=${formData.name} required class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />

                <label for="key">Connection Key</label>
                <input type="text" id="key" name="key" value=${formData.key} required class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600" />

                <label for="type">Interface Type</label>
                <select id="type" name="type" value=${interfaceType} onChange=${handleTypeChange} class="w-full px-4 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600">
                    ${Object.keys(interfaceTypes).map(type => html`<option value=${type}>${type}</option>`)}
                </select>

                <h2>Specific Parameters</h2>
                ${renderSpecificParams()}

                <button type="submit" class="btn btn-primary">Save Configuration</button>
            </form>
        </div>
    `;
};

export default NodesPage;
