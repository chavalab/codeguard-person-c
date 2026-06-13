import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const s3 = new S3Client({});
const sns = new SNSClient({});

async function streamToString(stream) {
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

async function postGitHubComment(body, prNumber) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  const url =
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      body
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
}

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

function getJobIdFromS3Key(key) {
  const parts = key.split("/");

  if (parts.length < 3) {
    throw new Error(
      `Invalid S3 key format: ${key}`
    );
  }

  return parts[1];
}

export const handler = async (event) => {
  console.log(
    "Incoming event:",
    JSON.stringify(event, null, 2)
  );

  const bucket = process.env.BUCKET_NAME;

  if (
    !event.Records ||
    event.Records.length === 0
  ) {
    throw new Error(
      "Missing S3 Records in event"
    );
  }

  const rawKey =
    event.Records[0].s3.object.key;

  const key = decodeURIComponent(
    rawKey.replace(/\+/g, " ")
  );

  const jobId = getJobIdFromS3Key(key);

  console.log("Bucket:", bucket);
  console.log("Report key:", key);
  console.log("Job ID:", jobId);

  // Read report.json
  const reportResponse = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  const report = JSON.parse(
    await streamToString(
      reportResponse.Body
    )
  );

  // Read metadata.json
  const metadataKey =
    `jobs/${jobId}/metadata.json`;

  const metadataResponse = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: metadataKey
    })
  );

  const metadata = JSON.parse(
    await streamToString(
      metadataResponse.Body
    )
  );

  const prNumber = metadata.prNumber;

  if (!prNumber) {
    throw new Error(
      `Missing prNumber in metadata.json for job ${jobId}`
    );
  }

  const highCount =
    report.summary?.high ?? 0;

  if (highCount > 0) {

    const emailMessage = `
CodeGuard Security Scan Report

Hello,

CodeGuard has completed a security scan for repository "${report.repo}".

The scan identified ${report.summary.total} security findings in total, including ${report.summary.high} high-severity issue(s), ${report.summary.medium} medium-severity issue(s), and ${report.summary.low} low-severity issue(s).

Attention is required because high-severity vulnerabilities were detected.

Most Critical Finding
---------------------

Severity: ${report.findings[0]?.severity || "N/A"}

Issue Type: ${report.findings[0]?.type || "N/A"}

Location: ${report.findings[0]?.file || "N/A"}${
      report.findings[0]?.line
        ? ` (Line ${report.findings[0].line})`
        : ""
    }

Description:
${report.findings[0]?.message || "No findings available."}

Recommendation:

Please review the affected code, remediate the issue, and submit an updated pull request for validation.

Thank you,

CodeGuard Automated Security Platform
`;

    await sns.send(
      new PublishCommand({
        TopicArn:
          process.env.SNS_TOPIC_ARN,
        Subject:
          "🚨 CodeGuard Security Alert",
        Message: emailMessage
      })
    );
  }

 
  // GITHUB STATUS CHECK / MERGE BLOCKING

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


  const topIssue =
    report.findings?.[0]?.message ||
    "No findings available";

  const comment = `## CodeGuard Scan Results

Repository: ${metadata.repo || report.repo}

Total Findings: ${report.summary?.total ?? 0}

High Severity: ${report.summary?.high ?? 0}

Medium Severity: ${report.summary?.medium ?? 0}

Low Severity: ${report.summary?.low ?? 0}

Top Issue:
${topIssue}
`;

  try {

    await postGitHubComment(
      comment,
      prNumber
    );

    console.log(
      "GitHub comment posted"
    );

  } catch (err) {

    console.error(
      "GitHub comment failed:",
      err.message
    );

  }

  return {
    statusCode: 200,
    jobId,
    prNumber,
    highCount
  };
};