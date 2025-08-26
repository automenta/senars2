# Agent Development Workflow

This document provides guidance for AI agents working on this codebase.

## Core Development Loop

A key part of developing this cognitive architecture is using its own principles to guide its development. We have a tool to help with this.

### Analyzing the State of the System

After making changes to the code, or to understand the current status of the project, you should run the analysis script:

```bash
npm run analyze
```

This script will:
1.  Run all unit tests with code coverage analysis.
2.  Identify any test failures.
3.  Report the overall code coverage.
4.  Check the status of the high-level functionality requirements against the test results.

### Interpreting the Output

The output of the `analyze` script is a "Development Analysis Report". Here is how to interpret it:

*   **🚨 Test Failures Detected**: This section lists any failing tests or test suites. These are the most immediate problems to address. The error messages will provide clues as to the source of the failure.
*   **📊 Code Coverage Summary**: This shows the percentage of statements, branches, and functions covered by tests. Low coverage in a file related to a test failure might indicate that more tests are needed.
*   **🎯 Functionality Requirements Status**: This shows the high-level goals of the project.
    *   `✅ MET`: If all tests are passing, the requirements are considered met.
    *   `⚠️ AT RISK`: If there are test failures, the requirements are considered at risk. This helps to connect low-level code issues with high-level project goals.

### Your Goal

Your goal as an agent is to make changes to the codebase that move all functionality requirements to the `✅ MET` status. This generally means fixing bugs to make all tests pass, and potentially adding new tests to increase code coverage and validate new functionality.

Use the report from the `analyze` script as your guide for what to work on next.
