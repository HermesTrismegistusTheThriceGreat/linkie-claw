/**
 * Fix n8n workflow expressions: change .item.json to .first().json
 * 
 * This fixes the "lost text" bug where binary upload nodes break
 * n8n's item linking, causing $('Node').item.json references to
 * return undefined after the binary chain.
 * 
 * .first().json bypasses item linking and always resolves.
 */

const N8N_BASE = "http://localhost:5678";
const WORKFLOW_ID = "Mn5iz3aOx2dQdNmY";

async function main() {
    // 1. Fetch the current workflow
    console.log("📥 Fetching workflow from n8n...");
    const getRes = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
        headers: { "Accept": "application/json" },
    });

    if (!getRes.ok) {
        throw new Error(`Failed to fetch workflow: ${getRes.status} ${getRes.statusText}`);
    }

    const workflow = await getRes.json();
    console.log(`   Workflow: "${workflow.name}" (${workflow.nodes.length} nodes)`);

    // 2. Track changes
    let changeCount = 0;
    const changes: string[] = [];

    // 3. Process each node
    for (const node of workflow.nodes) {
        const params = node.parameters;
        if (!params) continue;

        // Fix body expressions (used by HTTP Request nodes)
        if (typeof params.body === "string" && params.body.includes(".item.json")) {
            const before = params.body;
            params.body = params.body.replace(/\.\bitem\b\.json/g, ".first().json");
            if (before !== params.body) {
                const count = (before.match(/\.item\.json/g) || []).length;
                changes.push(`  ✏️  "${node.name}" body: ${count} expression(s) fixed`);
                changeCount += count;
            }
        }

        // Fix condition expressions (used by IF nodes)
        if (params.conditions?.conditions) {
            for (const cond of params.conditions.conditions) {
                if (typeof cond.leftValue === "string" && cond.leftValue.includes(".item.json")) {
                    const before = cond.leftValue;
                    cond.leftValue = cond.leftValue.replace(/\.\bitem\b\.json/g, ".first().json");
                    if (before !== cond.leftValue) {
                        changes.push(`  ✏️  "${node.name}" condition: fixed leftValue expression`);
                        changeCount++;
                    }
                }
            }
        }

        // Fix URL expressions
        if (typeof params.url === "string" && params.url.includes(".item.json")) {
            const before = params.url;
            params.url = params.url.replace(/\.\bitem\b\.json/g, ".first().json");
            if (before !== params.url) {
                changes.push(`  ✏️  "${node.name}" url: fixed expression`);
                changeCount++;
            }
        }

        // Fix Code node expressions (jsCode)
        if (typeof params.jsCode === "string" && params.jsCode.includes(".item.json")) {
            const before = params.jsCode;
            params.jsCode = params.jsCode.replace(/\.\bitem\b\.json/g, ".first().json");
            if (before !== params.jsCode) {
                changes.push(`  ✏️  "${node.name}" jsCode: fixed expression`);
                changeCount++;
            }
        }

        // Fix header parameter expressions
        if (params.headerParameters?.parameters) {
            for (const header of params.headerParameters.parameters) {
                if (typeof header.value === "string" && header.value.includes(".item.json")) {
                    const before = header.value;
                    header.value = header.value.replace(/\.\bitem\b\.json/g, ".first().json");
                    if (before !== header.value) {
                        changes.push(`  ✏️  "${node.name}" header "${header.name}": fixed expression`);
                        changeCount++;
                    }
                }
            }
        }
    }

    if (changeCount === 0) {
        console.log("\n⚠️  No .item.json expressions found — already fixed?");
        return;
    }

    console.log(`\n📝 Changes to apply (${changeCount} total):`);
    for (const c of changes) console.log(c);

    // 4. PUT the updated workflow back
    console.log("\n📤 Updating workflow in n8n...");
    const putRes = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workflow),
    });

    if (!putRes.ok) {
        const errBody = await putRes.text();
        throw new Error(`Failed to update workflow: ${putRes.status} ${putRes.statusText}\n${errBody}`);
    }

    const updated = await putRes.json();
    console.log(`\n✅ Workflow updated successfully!`);
    console.log(`   Version: ${updated.versionId}`);
    console.log(`   Updated at: ${updated.updatedAt}`);

    // 5. Verify by re-fetching and checking for .item.json
    console.log("\n🔍 Verifying no .item.json expressions remain...");
    const verifyRes = await fetch(`${N8N_BASE}/api/v1/workflows/${WORKFLOW_ID}`);
    const verified = await verifyRes.json();

    let remaining = 0;
    for (const node of verified.nodes) {
        const serialized = JSON.stringify(node.parameters || {});
        const matches = serialized.match(/\.item\.json/g);
        if (matches) {
            console.log(`  ⚠️  "${node.name}" still has ${matches.length} .item.json reference(s)`);
            remaining += matches.length;
        }
    }

    if (remaining === 0) {
        console.log("  ✅ All clear — no .item.json expressions remain");
    } else {
        console.log(`\n  ❌ ${remaining} expression(s) still need fixing`);
    }
}

main().catch((err) => {
    console.error("❌ Script failed:", err.message);
    process.exit(1);
});
