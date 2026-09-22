variable "s3_bucket_name" {
  description = "The name of the S3 bucket."
  type        = string
}
variable "s3_bucket_region" {
  description = "The region where the S3 bucket will be created."
  type        = string
}
variable "environment" {
  description = "The environment for which the S3 bucket is being created."
  type        = string
}