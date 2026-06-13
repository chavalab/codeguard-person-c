output "bucket_name" {
  value = aws_s3_bucket.reports.bucket
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

output "lambda_name" {
  value = aws_lambda_function.notifier.function_name
}