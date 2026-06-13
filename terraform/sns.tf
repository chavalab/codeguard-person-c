resource "aws_sns_topic" "alerts" {
  name = "CodeGuardAlertsTF"
}

resource "aws_sns_topic_subscription" "email_alerts" {

  topic_arn = aws_sns_topic.alerts.arn

  protocol = "email"

  endpoint = var.notification_email
}