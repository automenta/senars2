import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { FunctionalityRequirement, TestFailure, CodeCoverageReport } from '../src/meta/dev-types';
import { v4 as uuidv4 } from 'uuid';
import { UUID } from '../src/types/data';

const TEST_RESULTS_PATH = 'test-results.json';
const COVERAGE_SUMMARY_PATH = 'coverage/coverage-summary.json';
const REQUIREMENTS_PATH = 'meta/requirements.json';

// --- Type definitions for Jest's JSON output ---
type JestAssertionResult = {
    ancestorTitles: string[];
    fullName: string;
    status: 'passed' | 'failed';
    title: string;
    failureMessages: string[];
};

type JestTestResult = {
    assertionResults: JestAssertionResult[];
    status: 'passed' | 'failed';
    name: string; // The full path to the test file
    message: string; // Contains suite-level error messages
};

type JestJsonOutput = {
    testResults: JestTestResult[];
    success: boolean;
};

// --- Type definition for coverage summary ---
type CoverageSummary = {
    total: {
        statements: { pct: number };
        branches: { pct: number };
        functions: { pct: number };
    };
    [key: string]: any; // for individual file reports
};

/**
 * Runs the test:coverage npm script.
 */
function runTests(): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log('Running tests with coverage...');
        exec('npm run test:coverage', (error, stdout, stderr) => {
            if (error && error.code !== 0) {
                console.warn(`Test command exited with code ${error.code}, but we proceed to analysis.`);
            }
            console.log(stdout);
            console.error(stderr);
            console.log('Test run finished.');
            resolve();
        });
    });
}

/**
 * Parses the Jest JSON output to find failed tests.
 */
function analyzeTestFailures(): TestFailure[] {
    if (!fs.existsSync(TEST_RESULTS_PATH)) {
        console.error('Test results file not found!');
        return [];
    }
    const testData: JestJsonOutput = JSON.parse(fs.readFileSync(TEST_RESULTS_PATH, 'utf-8'));
    const failures: TestFailure[] = [];

    for (const testSuite of testData.testResults) {
        // Handle suite-level failures (e.g., compilation errors)
        if (testSuite.status === 'failed' && testSuite.assertionResults.length === 0) {
            const failure: TestFailure = {
                id: uuidv4() as UUID,
                atom_id: uuidv4() as UUID,
                type: 'BELIEF',
                truth: { frequency: 1.0, confidence: 0.3 },
                attention: { priority: 0.9, durability: 0.7 },
                stamp: {
                    timestamp: Date.now(),
                    parent_ids: [],
                    schema_id: 'analysis/suite-failure-detection' as UUID,
                },
                meta: {
                    type: 'dev/test-failure',
                    testName: `Suite: ${path.basename(testSuite.name)}`,
                    errorMessage: testSuite.message,
                },
            };
            failures.push(failure);
            continue; // Move to the next suite
        }

        // Handle individual test case failures
        for (const testCase of testSuite.assertionResults) {
            if (testCase.status === 'failed') {
                const failure: TestFailure = {
                    id: uuidv4() as UUID,
                    atom_id: uuidv4() as UUID,
                    type: 'BELIEF',
                    truth: { frequency: 1.0, confidence: 0.3 },
                    attention: { priority: 0.9, durability: 0.7 },
                    stamp: {
                        timestamp: Date.now(),
                        parent_ids: [],
                        schema_id: 'analysis/test-failure-detection' as UUID,
                    },
                    meta: {
                        type: 'dev/test-failure',
                        testName: testCase.fullName,
                        errorMessage: testCase.failureMessages.join('\n'),
                    },
                };
                failures.push(failure);
            }
        }
    }
    return failures;
}

/**
 * Parses the coverage summary to create coverage reports.
 */
function analyzeCodeCoverage(): CodeCoverageReport[] {
    if (!fs.existsSync(COVERAGE_SUMMARY_PATH)) {
        console.error('Coverage summary file not found!');
        return [];
    }
    const coverageData: CoverageSummary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY_PATH, 'utf-8'));
    const reports: CodeCoverageReport[] = [];

    for (const filePath in coverageData) {
        if (filePath === 'total') continue;

        const fileReport = coverageData[filePath];
        const report: CodeCoverageReport = {
            id: uuidv4() as UUID,
            atom_id: uuidv4() as UUID,
            type: 'BELIEF',
            truth: { frequency: 1.0, confidence: 1.0 },
            attention: { priority: 0.5, durability: 0.5 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [],
                schema_id: 'analysis/coverage-parsing' as UUID,
            },
            meta: {
                type: 'dev/coverage-report',
                filePath: path.relative(process.cwd(), filePath),
                statementCoverage: fileReport.statements.pct,
                branchCoverage: fileReport.branches.pct,
                functionCoverage: fileReport.functions.pct,
            },
        };
        reports.push(report);
    }
    return reports;
}

/**
 * Loads functionality requirements from the JSON file.
 */
function loadRequirements(): FunctionalityRequirement[] {
    if (!fs.existsSync(REQUIREMENTS_PATH)) {
        console.error('Requirements file not found!');
        return [];
    }
    return JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf-8'));
}

/**
 * A simple reasoning engine to connect failures, coverage, and requirements.
 */
function reason(failures: TestFailure[], coverage: CodeCoverageReport[], requirements: FunctionalityRequirement[]) {
    console.log('\n--- 🧠 Development Analysis Report ---');

    if (failures.length > 0) {
        console.log('\n🚨 Test Failures Detected:');
        for (const failure of failures) {
            console.log(`  - Test: ${failure.meta.testName}`);
            console.log(`    Error: ${failure.meta.errorMessage.split('\n')[0]}`);
            // Simple reasoning: find related file in coverage
            const relatedFile = coverage.find(c => failure.meta.testName.includes(path.basename(c.meta.filePath, '.ts')));
            if (relatedFile) {
                console.log(`    Possible related file: ${relatedFile.meta.filePath} (Coverage: ${relatedFile.meta.statementCoverage}%)`);
            }
        }
    } else {
        console.log('\n✅ All tests passed!');
    }

    console.log('\n📊 Code Coverage Summary:');
    const totalCoverage = coverage.find(c => c.meta.filePath.endsWith('total')); // Heuristic
    if (totalCoverage) {
        // This is not how the summary is structured, need to get the 'total' key
    }
    const summary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY_PATH, 'utf-8'));
    console.log(`  - Statements: ${summary.total.statements.pct}%`);
    console.log(`  - Branches: ${summary.total.branches.pct}%`);
    console.log(`  - Functions: ${summary.total.functions.pct}%`);


    console.log('\n🎯 Functionality Requirements Status:');
    for (const req of requirements) {
        // Simple reasoning: if there are failures, the requirements might be at risk.
        const status = failures.length > 0 ? '⚠️ AT RISK' : '✅ MET';
        console.log(`  - [${status}] ${req.meta.description}`);
    }

    console.log('\n--- End of Report ---');
}


async function main() {
    await runTests();
    const failures = analyzeTestFailures();
    const coverage = analyzeCodeCoverage();
    const requirements = loadRequirements();
    reason(failures, coverage, requirements);
}

main().catch(error => {
    console.error('Analysis script failed:', error);
    process.exit(1);
});
