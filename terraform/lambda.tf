data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "../lambda/index.mjs"
  output_path = "../lambda/notifier.zip"
}

resource "aws_lambda_function" "notifier" {
  function_name = "codeguard-notifier-tf"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  handler = "index.handler"
  runtime = "nodejs22.x"
  role    = var.lab_role_arn
    timeout = 30


  environment {
    variables = {
      BUCKET_NAME   = aws_s3_bucket.reports.bucket
      GITHUB_OWNER  = var.github_owner
      GITHUB_REPO   = var.github_repo
      GITHUB_TOKEN  = var.github_token
      SNS_TOPIC_ARN = aws_sns_topic.alerts.arn
    }
  }
}