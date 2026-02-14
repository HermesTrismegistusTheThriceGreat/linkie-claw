---
description: Create a comprehensive implementation plan from requirements through extensive research
argument-hint: [requirements-file-path]
---

# Create Implementation Plan from Requirements

You are about to create a comprehensive implementation plan based on initial requirements. This involves extensive research, analysis, and planning to produce a detailed roadmap for execution.

## Step 1: Read and Analyze Requirements

Read the requirements document from: $ARGUMENTS

Extract and understand:
- Core feature requests and objectives
- Technical requirements and constraints
- Expected outcomes and success criteria
- Integration points with existing systems
- Performance and scalability requirements
- Any specific technologies or frameworks mentioned

## Step 2: Research Phase

### 2.1 Web Research (if applicable)
- Search for best practices for the requested features
- Look up documentation for any mentioned technologies
- Find similar implementations or case studies
- Research common patterns and architectures
- Investigate potential libraries or tools

### 2.2 Codebase Analysis

**IMPORTANT: Use the `codebase-analyst` agent for deep pattern analysis**
- Launch the codebase-analyst agent using the Task tool to perform comprehensive pattern discovery
- The agent will analyze: architecture patterns, coding conventions, testing approaches, and similar implementations
- Use the agent's findings to ensure your plan follows existing patterns and conventions

For quick searches you can also:
- Use Grep to find specific features or patterns
- Identify the project structure and conventions
- Locate relevant modules and components
- Understand existing architecture and design patterns
- Find integration points for new features
- Check for existing utilities or helpers to reuse

### 2.3 Read Project Context
- Read `CLAUDE.md` for project conventions and key file paths
- Read relevant phase docs from `docs/roadmap/` if applicable
- Check `docs/PREREQUISITES.md` for required env vars and services

## Step 3: Planning and Design

Based on your research, create a detailed plan that includes:

### 3.1 Task Breakdown
Create a prioritized list of implementation tasks:
- Each task should be specific and actionable
- Tasks should be sized appropriately
- Include dependencies between tasks
- Order tasks logically for implementation flow

### 3.2 Technical Architecture
Define the technical approach:
- Component structure and organization
- Data flow and state management
- API design (if applicable)
- Database schema changes (if needed)
- Integration points with existing code

### 3.3 Implementation References
Document key resources for implementation:
- Existing code files to reference or modify
- Documentation links for technologies used
- Code examples from research
- Patterns to follow from the codebase
- Libraries or dependencies to add

## Step 4: Create the Plan Document

Write a comprehensive plan to `docs/plans/[feature-name].md` with this structure:

```markdown
# Implementation Plan: [Feature Name]

## Overview
[Brief description of what will be implemented]

## Requirements Summary
- [Key requirement 1]
- [Key requirement 2]
- [Key requirement n]

## Research Findings
### Best Practices
- [Finding 1]
- [Finding n]

### Reference Implementations
- [Example 1 with link/location]
- [Example n with link/location]

### Technology Decisions
- [Technology choice 1 and rationale]
- [Technology choice n and rationale]

## Agent Build Order & Communication

When building with an agent team, agents MUST follow this contract-first sequence:

### Contract Chain
[Define: Database → Backend → Frontend or similar dependency chain]

### Agent Roles
[Define each agent's ownership, responsibilities, and off-limits areas]

### Cross-Cutting Concerns
[Assign shared behaviors to specific agents]

## Implementation Tasks

### Phase 1: Foundation
1. **Task Name**
   - Description: [What needs to be done]
   - Files to modify/create: [List files]
   - Dependencies: [Any prerequisites]

2. **Task Name**
   - ...

### Phase 2: Core Implementation
[Continue with numbered tasks...]

### Phase 3: Integration & Testing
[Continue with numbered tasks...]

## Codebase Integration Points
### Files to Modify
- `path/to/file1` - [What changes needed]

### New Files to Create
- `path/to/newfile1` - [Purpose]

### Existing Patterns to Follow
- [Pattern 1 from codebase]

## Validation

### Per-Agent Validation
[Specific validation commands for each agent's domain]

### End-to-End Validation
[Full flow to run after integration]

## Success Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion n]
```

## Step 5: Validation

Before finalizing the plan:
1. Ensure all requirements are addressed
2. Verify tasks are properly sequenced
3. Check that integration points are identified
4. Confirm research supports the approach
5. Make sure the plan is actionable and clear
6. Verify the contract chain is defined for agent teams

## Important Guidelines

- **Be thorough in research**: The quality of the plan depends on understanding best practices
- **Keep it actionable**: Every task should be clear and implementable
- **Reference everything**: Include links, file paths, and examples
- **Consider the existing codebase**: Follow established patterns and conventions from CLAUDE.md
- **Think about testing**: Include testing tasks in the plan
- **Design for agent teams**: Include contract chain, agent roles, and cross-cutting concerns

## Output

Save the plan to the docs/plans directory and inform the user:
"Implementation plan created at: docs/plans/[feature-name].md
You can now execute this plan using: `/build-with-agent-team docs/plans/[feature-name].md`"
