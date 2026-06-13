# CodeGuard

## Cloud-Based Security Scan Notification Platform

CodeGuard is a cloud-native security notification platform built on AWS. The system processes security scan reports, generates automated notifications, and integrates with GitHub Pull Requests to provide developers with immediate feedback on security findings.

The project demonstrates the use of AWS serverless services, event-driven architecture, infrastructure as code, and DevSecOps concepts.

---

# Project Architecture

```text
Security Scanner
        │
        ▼
   report.json
        │
        ▼
 Amazon S3 Bucket
        │
        ▼
 S3 Event Notification
        │
        ▼
 AWS Lambda (Notifier)
        │
 ┌──────┼───────────────┐
 │      │               │
 ▼      ▼               ▼

SNS    GitHub PR     Status Check
Email  Comment       (Optional)

```

---

# Features

CodeGuard currently performs the following actions automatically:

* Stores security scan reports in Amazon S3
* Triggers AWS Lambda when a report is uploaded
* Reads report and metadata files from S3
* Generates security summaries
* Sends SNS email notifications for high-severity findings
* Posts scan results directly to GitHub Pull Requests
* Supports GitHub Status Checks (currently disabled)
* Built entirely using Terraform Infrastructure as Code

---

# Repository Structure

```text
codeguard/

├── lambda/
│   ├── index.mjs
│   └── notifier.zip
│
├── sample-data/
│   ├── metadata.json
│   └── report.json
│
├── terraform/
│   ├── provider.tf
│   ├── versions.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── lambda.tf
│   ├── s3.tf
│   ├── s3-trigger.tf
│   └── sns.tf
│
└── README.md
```

---

# AWS Services Used

## Amazon S3

Stores:

* Security scan reports
* Metadata files

Example:

```text
jobs/demo001/report.json
jobs/demo001/metadata.json
```

---

## AWS Lambda

Responsible for:

* Reading reports from S3
* Reading metadata from S3
* Generating notifications
* Posting GitHub comments
* Publishing SNS alerts
* (Optional) Creating GitHub Status Checks

Runtime:

```text
Node.js 20.x
```

---

## Amazon SNS

Used to send email notifications when:

```text
High Severity Findings > 0
```

Example Email:

```text
CodeGuard Security Scan Report

Repository: chavalab/codeguard-demo

Total Findings: 5
High Severity: 2
Medium Severity: 1
Low Severity: 1

Most Critical Finding:
Hardcoded AWS key found

Recommendation:
Review and remediate immediately.
```

---

# Sample Metadata Format

The Lambda function expects metadata in the following format:

```json
{
  "jobId": "demo001",
  "repo": "chavalab/codeguard-demo",
  "prNumber": 10
}
```

---

# Sample Report Format

```json
{
  "jobId": "demo001",
  "repo": "chavalab/codeguard-demo",
  "summary": {
    "total": 5,
    "high": 2,
    "medium": 1,
    "low": 2
  },
  "findings": [
    {
      "severity": "HIGH",
      "type": "hardcoded-secret",
      "file": "src/app.js",
      "line": 10,
      "message": "Hardcoded AWS key found"
    }
  ]
}
```

---

# GitHub Pull Request Integration

CodeGuard automatically posts scan summaries directly into Pull Requests.

Example Comment:

```text
CodeGuard Scan Results

Repository: chavalab/codeguard-demo

Total Findings: 5

High Severity: 2
Medium Severity: 1
Low Severity: 2

Top Issue:
Hardcoded AWS key found
```

This allows developers to review security findings directly inside GitHub.

---

# Infrastructure Deployment

Terraform provisions:

* S3 Bucket
* SNS Topic
* Lambda Function
* Lambda IAM Permissions
* S3 Event Notifications

Deployment:

```bash
cd terraform

terraform init

terraform plan

terraform apply
```

---

# Lambda Deployment

After modifying:

```text
lambda/index.mjs
```

Create deployment package:

```bash
cd lambda

zip notifier.zip index.mjs
```

Redeploy:

```bash
cd ../terraform

terraform apply
```

---

# GitHub Status Checks and Merge Protection

## Overview

In addition to notifications and pull request comments, CodeGuard has been designed to support GitHub Status Checks.

When enabled, CodeGuard can automatically pass or fail Pull Requests based on security findings.

This allows the platform to function as a lightweight DevSecOps security gate.

---

## Current Implementation Status

The helper function required to create GitHub Status Checks already exists in:

```text
lambda/index.mjs
```

However, the execution block is intentionally commented out.

Example:

```javascript
/*
try {

  await createGitHubStatus(
    metadata.commitSha,
    highCount > 0
      ? "failure"
      : "success",
    highCount > 0
      ? `${highCount} high severity findings detected`
      : "No high severity findings detected"
  );

} catch (err) {

  console.error(err);

}
*/
```

Because the code is commented, GitHub Status Checks are currently disabled.

The project currently:

✅ Sends SNS notifications

✅ Posts Pull Request comments

❌ Does not block Pull Request merges

---

## Why It Is Disabled

GitHub Status Checks require a valid commit SHA.

The current project workflow does not yet guarantee that every scan job contains:

```json
{
  "commitSha": "..."
}
```

inside metadata.

To avoid invalid GitHub API calls during demonstrations and testing, the functionality remains disabled.

---

## Required Metadata Structure for Status Checks

```json
{
  "jobId": "demo001",
  "repo": "chavalab/codeguard-demo",
  "prNumber": 10,
  "commitSha": "8f4b8f7d7d8f4b8f7d7d8f4b8f7d7d8f4b8f7d7d"
}
```

Field meanings:

| Field     | Purpose             |
| --------- | ------------------- |
| jobId     | Scan identifier     |
| repo      | Repository name     |
| prNumber  | Pull Request number |
| commitSha | Head commit SHA     |

---

## Additional Report Requirement

The report may also include:

```json
{
  "commitSha": "abc123"
}
```

for easier downstream processing.

---

## Steps Required to Enable Merge Protection

### 1. Include commitSha in metadata.json

Example:

```json
{
  "commitSha": "abc123"
}
```

---

### 2. Ensure GitHub Token Permissions

The GitHub Personal Access Token must allow:

* Pull Request access
* Commit Status access
* Repository access

---

### 3. Uncomment Status Check Logic

Inside:

```text
lambda/index.mjs
```

remove the comment block surrounding:

```javascript
createGitHubStatus(...)
```

---

### 4. Redeploy Lambda

```bash
zip notifier.zip index.mjs

terraform apply
```

---

### 5. Configure GitHub Branch Protection

Navigate to:

```text
Repository Settings
    → Branches
    → Branch Protection Rules
```

Enable:

```text
Require status checks before merging
```

Select:

```text
CodeGuard Security Scan
```

---

## Expected Behavior

### High Severity Findings Present

Input:

```json
{
  "summary": {
    "high": 2
  }
}
```

Result:

```text
CodeGuard Security Scan ❌ Failed

2 high severity findings detected
```

Pull Request merge will be blocked.

---

### No High Severity Findings

Input:

```json
{
  "summary": {
    "high": 0
  }
}
```

Result:

```text
CodeGuard Security Scan ✅ Passed

No high severity findings detected
```

Pull Request merge will be allowed.

---

# Security Benefits

CodeGuard demonstrates several DevSecOps concepts:

* Automated security notifications
* Event-driven security workflows
* Pull Request security feedback
* Infrastructure as Code
* Serverless architecture
* Optional security gate enforcement
* Integration between AWS and GitHub

---

# Future Enhancements

Potential improvements include:

* Multiple finding summaries
* Rich HTML email reports
* Slack notifications
* DynamoDB scan history
* Security dashboards
* Multi-repository support
* Automatic merge blocking using GitHub Status Checks
* Integration with external scanners such as Trivy or SonarQube

---

# Author

Bala Asrith Chavala

Northeastern University

Cloud Computing / DevSecOps Project
