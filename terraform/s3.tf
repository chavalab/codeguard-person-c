resource "aws_s3_bucket" "reports" {
  bucket = "codeguard-tf"
}
resource "aws_s3_object" "demo_report" {

  bucket = aws_s3_bucket.reports.id

  key = "jobs/demo001/report.json"

  source = "../sample-data/report.json"

  etag = filemd5("../sample-data/report.json")
}
resource "aws_s3_object" "demo_metadata" {
  bucket = aws_s3_bucket.reports.id
  key    = "jobs/demo001/metadata.json"
  source = "../sample-data/metadata.json"

  etag = filemd5("../sample-data/metadata.json")
}