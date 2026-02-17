const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../n8n/workflows/linkedin-publish.json');
const content = fs.readFileSync(filePath, 'utf8');
const workflow = JSON.parse(content);

console.log(`Loaded workflow: ${workflow.name} (${workflow.id})`);

const nodesToUpdate = [
    'Get Person URN',
    'HTTP Request - Text Post',
    'Initialize Upload',
    'Upload Binary',
    'Create Post With Image'
];

workflow.nodes.forEach(node => {
    if (nodesToUpdate.includes(node.name)) {
        console.log(`Updating node: ${node.name}`);

        // Remove credentials
        if (node.credentials) {
            delete node.credentials;
        }

        // Update authentication
        if (node.parameters.authentication) {
            delete node.parameters.authentication;
        }
        if (node.parameters.nodeCredentialType) {
            delete node.parameters.nodeCredentialType;
        }

        // Add Authorization header
        // Check if headerParameters exists
        if (!node.parameters.sendHeaders) {
            node.parameters.sendHeaders = true;
        }

        if (!node.parameters.headerParameters) {
            node.parameters.headerParameters = { parameters: [] };
        }

        const headers = node.parameters.headerParameters.parameters || [];

        // Check if Authorization header already exists
        const authHeaderIndex = headers.findIndex(h => h.name === 'Authorization');
        const authHeaderValue = "=Bearer {{ $('Webhook').item.json.body.accessToken }}";

        if (authHeaderIndex === -1) {
            headers.push({
                name: 'Authorization',
                value: authHeaderValue
            });
        } else {
            headers[authHeaderIndex].value = authHeaderValue;
        }

        node.parameters.headerParameters.parameters = headers;
    }
});

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2));
console.log('Workflow updated successfully.');
