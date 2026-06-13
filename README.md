# GitHub Status Checks and Merge Protection

## Overview

CodeGuard currently performs the following actions automatically:

* Reads security scan results from Amazon S3
* Sends SNS email notifications for high-severity findings
* Posts scan summaries directly to GitHub Pull Requests

In addition to these capabilities, CodeGuard has been designed to support GitHub Status Checks, allowing it to function as a security gate within a CI/CD pipeline.

This feature is currently implemented in the Lambda source code but intentionally disabled.

---

## Current Implementation Status

The helper function required to create GitHub Status Checks already exists in `lambda/index.mjs`:

```javascript
async function createGitHubStatus(
  sha,
  state,
  description
) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        state,
        description,
        context: "CodeGuard Security Scan"
      })
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }
}
```

The execution block is currently commented out:

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

  console.log(
    "GitHub status updated"
  );

} catch (err) {

  console.error(
    "GitHub status update failed:",
    err.message
  );

}
*/
```

---

## Why Is It Disabled?

GitHub Status Checks require a valid commit SHA.

The current project workflow does not yet guarantee that every scan job contains a valid:

```json
{
  "commitSha": "..."
}
```

value in `metadata.json`.

Because the feature depends on upstream integration, the status check logic remains commented out until commit SHA propagation is finalized.

This prevents invalid status updates during testing and demonstrations.

---

## Required Metadata Structure

To enable Status Checks, `metadata.json` must contain:

```json
{
  "jobId": "demo001",
  "repo": "chavalab/codeguard-demo",
  "prNumber": 10,
  "commitSha": "8f4b8f7d7d8f4b8f7d7d8f4b8f7d7d8f4b8f7d7d"
}
```

### Field Descriptions

| Field     | Description                                   |
| --------- | --------------------------------------------- |
| jobId     | Unique scan identifier                        |
| repo      | Repository name                               |
| prNumber  | GitHub Pull Request number                    |
| commitSha | Commit SHA associated with the PR head commit |

The `commitSha` field is mandatory because GitHub Status Checks are attached to commits rather than pull requests.

---

## Required Report Structure

```json
{
  "jobId": "demo001",
  "repo": "chavalab/codeguard-demo",
  "commitSha": "abc123",
  "summary": {
    "total": 3,
    "high": 1,
    "medium": 1,
    "low": 1
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

## Requirements to Enable Status Checks

The following requirements must be met:

### 1. Metadata Must Include Commit SHA

Every scan job must provide:

```json
{
  "commitSha": "<valid commit sha>"
}
```

inside `metadata.json`.

### 2. GitHub Token Permissions

The GitHub Personal Access Token used by Lambda must have permission to:

* Read Pull Requests
* Create Pull Request comments
* Create Commit Statuses

### 3. Uncomment Status Check Logic

Inside `lambda/index.mjs`, uncomment the GitHub Status Check block.

### 4. Redeploy Lambda

After enabling the code:

```bash
terraform plan
terraform apply
```

must be executed so the updated Lambda package is deployed.

### 5. Configure Branch Protection Rules

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

Then select:

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

GitHub will prevent the pull request from being merged.

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

GitHub will allow the pull request to be merged.

---

## Security Benefits

Implementing GitHub Status Checks transforms CodeGuard from a notification system into an automated security gate.

Benefits include:

* Preventing vulnerable code from being merged
* Enforcing security policies automatically
* Integrating security directly into the CI/CD pipeline
* Reducing manual reviewer effort
* Mimicking enterprise DevSecOps workflows

---

## Future Enhancement Summary

The functionality is already partially implemented within the Lambda source code.

The only remaining requirements are:

* Consistent availability of `commitSha`
* Branch Protection configuration
* Uncommenting the status check logic
* Redeploying the Lambda

Once those requirements are met, CodeGuard can automatically block pull requests that contain high-severity security vulnerabilities.
