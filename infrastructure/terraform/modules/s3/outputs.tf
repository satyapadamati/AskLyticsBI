output "s3_bucket_name" {
  value = aws_s3_bucket.this.bucket
}

output "s3_bucket_region" {
  value = aws_s3_bucket.this.region
}
output "s3_bucket_arn" {
  value = aws_s3_bucket.this.arn
}
output "s3_bucket_domain_name" {
  value = aws_s3_bucket.this.bucket_regional_domain_name
}