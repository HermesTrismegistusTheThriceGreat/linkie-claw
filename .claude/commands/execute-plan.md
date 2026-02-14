---
description: Execute a development plan with systematic task tracking
argument-hint: [plan-file-path]
---

# Execute Development Plan

You are about to execute a comprehensive development plan with systematic task tracking. This workflow ensures every task is tracked from creation to completion.

## Critical Requirements

**MANDATORY**: Throughout execution, maintain continuous task tracking. Every task from the plan must be tracked from creation to completion using the built-in task management tools.

## Step 1: Read and Parse the Plan

Read the plan file specified in: $ARGUMENTS

The plan file will contain:
- A list of tasks to implement
- References to existing codebase components and integration points
- Context about where to look in the codebase for implementation

## Step 2: Create All Tasks

For EACH task identified in the plan:
1. Create a corresponding task using TaskCreate
2. Include detailed descriptions from the plan
3. Maintain the task order/priority from the plan
4. Set up dependencies between tasks using addBlockedBy/addBlocks

**IMPORTANT**: Create ALL tasks upfront before starting implementation. This ensures complete visibility of the work scope.

## Step 3: Codebase Analysis

Before implementation begins:
1. Read `CLAUDE.md` for project conventions and key file paths
2. Analyze ALL integration points mentioned in the plan
3. Use Grep and Glob tools to:
   - Understand existing code patterns
   - Identify where changes need to be made
   - Find similar implementations for reference
4. Read all referenced files and components
5. Build a comprehensive understanding of the codebase context

## Step 4: Implementation Cycle

For EACH task in sequence:

### 4.1 Start Task
- Move the current task to "in_progress" status using TaskUpdate

### 4.2 Implement
- Execute the implementation based on:
  - The task requirements from the plan
  - Your codebase analysis findings
  - Best practices and existing patterns from CLAUDE.md
- Make all necessary code changes
- Ensure code quality and consistency

### 4.3 Validate
- Run `npm run typecheck` after any type/schema changes
- Run `npm run lint:fix` to catch lint issues
- Verify the change works as expected

### 4.4 Complete Task
- Once implementation and validation pass, mark task as "completed" using TaskUpdate

### 4.5 Proceed to Next
- Check TaskList for the next available task
- Move to the next unblocked task
- Repeat steps 4.1-4.4

**CRITICAL**: Complete each task before starting the next unless tasks are independent and can be parallelized.

## Step 5: Full Validation

After ALL tasks are completed:

**Use the `validator` agent for comprehensive testing**
1. Launch the validator agent using the Task tool
   - Provide a detailed description of what was built
   - Include the list of features implemented and files modified
   - The validator will verify functionality and report results

Additional validation:
- Run `npm run typecheck && npm run lint:fix && npm run build`
- Check for integration issues between components
- Ensure all acceptance criteria from the plan are met

## Step 6: Final Report

Provide a summary including:
- Total tasks created and completed
- Validation results
- Key features implemented
- Any issues encountered and how they were resolved
- Files modified/created

## Workflow Rules

1. **ALWAYS** create all tasks upfront before starting implementation
2. **MAINTAIN** one task in "in_progress" status at a time
3. **VALIDATE** all work before marking tasks as completed
4. **TRACK** progress continuously through task status updates
5. **ANALYZE** the codebase thoroughly before implementation
6. **FOLLOW** conventions from CLAUDE.md at all times
7. **RUN** typecheck and lint after every significant change

## Error Handling

If implementation fails:
1. Document the issue in the task
2. Investigate the root cause
3. Fix and re-validate
4. Never mark a task as completed if validation fails
