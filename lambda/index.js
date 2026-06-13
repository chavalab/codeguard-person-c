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

export const handler = async (event) => {

  const bucket = process.env.BUCKET_NAME;

  const jobId = event.jobId;

  const key = `jobs/${jobId}/report.json`;

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  const report = JSON.parse(
    await streamToString(response.Body)
  );

  const highCount = report.summary.high;

  if (highCount > 0) {

    await sns.send(
      new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: "CodeGuard Security Alert",
        Message: JSON.stringify(report, null, 2)
      })
    );

  }

  console.log("Report Loaded");
  console.log(report);

  return {
    statusCode: 200,
    highCount
  };
};
