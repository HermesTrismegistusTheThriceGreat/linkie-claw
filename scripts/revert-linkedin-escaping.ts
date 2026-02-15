/**
 * Revert LinkedIn escaping from n8n workflow Code nodes.
 *
 * The escaping is now handled at the application layer (internal API),
 * so the n8n Code nodes must NOT also escape — that would double-escape.
 *
 * This script restores the original jsCode for both Code nodes.
 */

import { readFileSync, writeFileSync } from "fs";

const INPUT_PATH = "/tmp/n8n_workflow_current.json";
const OUTPUT_PATH = "/tmp/n8n_workflow_reverted.json";

// Original jsCode for "Build Text Post Body" (before our patch)
const ORIGINAL_TEXT_POST_CODE = [
    "const post = $('HTTP Request - Fetch Post').first().json;",
    "const personUrn = $('Get Person URN').first().json.sub;",
    "",
    "const body = {",
    "  author: 'urn:li:person:' + personUrn,",
    "  commentary: post.content,",
    "  visibility: 'PUBLIC',",
    "  distribution: {",
    "    feedDistribution: 'MAIN_FEED',",
    "    targetEntities: [],",
    "    thirdPartyDistributionChannels: []",
    "  },",
    "  lifecycleState: 'PUBLISHED',",
    "  isReshareDisabledByAuthor: false",
    "};",
    "",
    "return [{",
    "  json: {",
    "    requestBody: JSON.stringify(body)",
    "  }",
    "}];",
].join("\n");

// Original jsCode for "Build Image Post Body" (before our patch)
const ORIGINAL_IMAGE_POST_CODE = [
    "const post = $('HTTP Request - Fetch Post').first().json;",
    "const personUrn = $('Get Person URN').first().json.sub;",
    "const imageId = $('Initialize Upload').first().json.value.image;",
    "",
    "const body = {",
    "  author: 'urn:li:person:' + personUrn,",
    "  commentary: post.content,",
    "  visibility: 'PUBLIC',",
    "  distribution: {",
    "    feedDistribution: 'MAIN_FEED',",
    "    targetEntities: [],",
    "    thirdPartyDistributionChannels: []",
    "  },",
    "  lifecycleState: 'PUBLISHED',",
    "  isReshareDisabledByAuthor: false,",
    "  content: {",
    "    media: {",
    "      title: 'Post image',",
    "      id: imageId,",
    "      altText: post.imageAltText || ''",
    "    }",
    "  }",
    "};",
    "",
    "return [{",
    "  json: {",
    "    requestBody: JSON.stringify(body)",
    "  }",
    "}];",
].join("\n");

const NODE_CODE_MAP: Record<string, string> = {
    "Build Text Post Body": ORIGINAL_TEXT_POST_CODE,
    "Build Image Post Body": ORIGINAL_IMAGE_POST_CODE,
};

function main() {
    console.log("Reading current workflow...");
    const raw = readFileSync(INPUT_PATH, "utf-8");
    const workflows = JSON.parse(raw);
    const workflow = workflows[0];
    console.log("  Workflow: \"" + workflow.name + "\" (" + workflow.nodes.length + " nodes)");

    let changeCount = 0;

    for (const node of workflow.nodes) {
        const originalCode = NODE_CODE_MAP[node.name];
        if (!originalCode) continue;
        if (!node.parameters?.jsCode) continue;

        const currentCode: string = node.parameters.jsCode;

        if (!currentCode.includes("escapeForLinkedIn")) {
            console.log("  \"" + node.name + "\" -- no escaping found, already original");
            continue;
        }

        node.parameters.jsCode = originalCode;
        changeCount++;
        console.log("  Reverted \"" + node.name + "\" to original code");
    }

    if (changeCount === 0) {
        console.log("\nNo changes needed -- nodes are already at original state.");
        return;
    }

    console.log("\nWriting reverted workflow...");
    writeFileSync(OUTPUT_PATH, JSON.stringify(workflows, null, 2), "utf-8");

    // Print reverted Code nodes for review
    console.log("\n--- Reverted Code Node Contents ---");
    for (const node of workflow.nodes) {
        if (!(node.name in NODE_CODE_MAP)) continue;
        console.log("\n=== " + node.name + " ===");
        console.log(node.parameters.jsCode);
        const hasEscape = node.parameters.jsCode.includes("escapeForLinkedIn");
        console.log("  Contains escapeForLinkedIn: " + hasEscape + " (should be false)");
    }

    console.log("\nReverted " + changeCount + " node(s). Ready to import.");
}

main();
