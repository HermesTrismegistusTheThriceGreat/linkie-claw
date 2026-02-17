/**
 * Fix LinkedIn 'little' text format escaping in n8n workflow.
 *
 * LinkedIn's Posts API commentary field uses the 'little' text format,
 * which requires all reserved characters to be backslash-escaped:
 *   | { } @ [ ] ( ) < > # \ * _ ~
 *
 * Without escaping, characters like ( can be misinterpreted as
 * MentionElement syntax, causing silent truncation.
 *
 * This script:
 * 1. Reads the exported workflow JSON from the n8n container
 * 2. Patches the two Code nodes to add escaping
 * 3. Writes the patched JSON and reimports via n8n CLI
 *
 * Reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
 */

import { readFileSync, writeFileSync } from "fs";

const INPUT_PATH = "/tmp/n8n_workflow_export.json";
const OUTPUT_PATH = "/tmp/n8n_workflow_patched.json";

// The exact JavaScript that should appear in the n8n Code node.
// Using regular string concatenation to avoid template literal escaping issues.
// When n8n executes this, the regex /[|{}@\[\]()<>#\\*_~]/g matches the reserved chars
// and '\\$&' replaces each with backslash + the matched char.
const ESCAPE_FUNCTION_LINES = [
    "// Escape LinkedIn 'little' text format reserved characters",
    "const escapeForLinkedIn = (text) => {",
    "  return text.replace(/[|{}@\\[\\]()<>#\\\\*_~]/g, '\\\\$&');",
    "};",
];

const TARGET_NODES = ["Build Text Post Body", "Build Image Post Body"];

function main() {
    // 1. Read the exported workflow
    console.log("Reading exported workflow...");
    const raw = readFileSync(INPUT_PATH, "utf-8");
    const workflows = JSON.parse(raw);
    const workflow = workflows[0]; // Export format is an array
    console.log("  Workflow: \"" + workflow.name + "\" (" + workflow.nodes.length + " nodes)");

    // 2. Track changes
    let changeCount = 0;
    const changes: string[] = [];

    // 3. Process target Code nodes
    for (const node of workflow.nodes) {
        if (!TARGET_NODES.includes(node.name)) continue;
        if (!node.parameters?.jsCode) continue;

        const jsCode: string = node.parameters.jsCode;

        // Check if already patched
        if (jsCode.includes("escapeForLinkedIn")) {
            console.log("  \"" + node.name + "\" -- already patched, skipping");
            continue;
        }

        // Check that the node contains the line we expect
        if (!jsCode.includes("commentary: post.content")) {
            console.log("  WARNING: \"" + node.name + "\" does not contain 'commentary: post.content' -- skipping");
            continue;
        }

        // Build the escape function block to insert
        const escapeBlock = ESCAPE_FUNCTION_LINES.join("\n") + "\n\n";

        // Insert the escape function before "const body = {"
        // Must use a replacer function to avoid $& being interpreted as a
        // replacement pattern by String.prototype.replace()
        let newCode = jsCode.replace(
            "const body = {",
            () => escapeBlock + "const body = {"
        );

        // Replace commentary assignment
        newCode = newCode.replace(
            "commentary: post.content",
            "commentary: escapeForLinkedIn(post.content)"
        );

        node.parameters.jsCode = newCode;
        changeCount++;
        changes.push("  Patched \"" + node.name + "\": added escapeForLinkedIn() + updated commentary assignment");
    }

    if (changeCount === 0) {
        console.log("\nNo changes needed -- nodes already patched or not found.");
        return;
    }

    console.log("\nChanges applied (" + changeCount + " node(s)):");
    for (const c of changes) console.log(c);

    // 4. Write the patched workflow
    console.log("\nWriting patched workflow to " + OUTPUT_PATH + "...");
    writeFileSync(OUTPUT_PATH, JSON.stringify(workflows, null, 2), "utf-8");

    // 5. Print patched Code nodes for review
    console.log("\n--- Updated Code Node Contents ---");
    for (const node of workflow.nodes) {
        if (!TARGET_NODES.includes(node.name)) continue;
        console.log("\n=== " + node.name + " ===");
        console.log(node.parameters.jsCode);
    }

    // 6. Verify the jsCode contains the correct regex
    // The jsCode string should contain the literal text: /[|{}@\[\]()<>#\\*_~]/g, '\\$&'
    // (single backslashes in the source code)
    console.log("\n--- Verification ---");
    for (const node of workflow.nodes) {
        if (!TARGET_NODES.includes(node.name)) continue;
        const code = node.parameters.jsCode;
        const hasEscapeFunc = code.includes("escapeForLinkedIn");
        const hasCorrectUsage = code.includes("commentary: escapeForLinkedIn(post.content)");
        // In the jsCode string, we should see literal: '\\$&' (backslash, dollar, ampersand)
        const hasCorrectReplacement = code.includes("'\\\\$&'");
        console.log(node.name + ":");
        console.log("  escapeForLinkedIn present: " + hasEscapeFunc);
        console.log("  commentary uses escaping: " + hasCorrectUsage);
        console.log("  replacement string correct: " + hasCorrectReplacement);
    }

    console.log("\nPatched workflow written successfully.");
}

main();
