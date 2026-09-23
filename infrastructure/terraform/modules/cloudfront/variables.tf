variable "environment" {
  description = "The environment for which the CloudFront distribution is being provisioned."
  type        = string
} 
variable "bucket_id" {
  description = "The ID of the S3 bucket to be used with the CloudFront distribution."
  type        = string
}   
variable "bucket_name" {
  description = "The name of the S3 bucket, used for the bucket policy (must be the actual bucket name, not its domain name)."
  type        = string
}
variable "bucket_arn" {
  description = "The ARN of the S3 bucket to be used with the CloudFront distribution."
  type        = string
}