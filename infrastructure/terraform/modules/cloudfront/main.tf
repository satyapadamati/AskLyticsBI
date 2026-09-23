resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "asklyticsbi-${var.environment}-oac"
  description                       = "OAC for AskLyticsBI frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  custom_error_response {
  error_code         = 403
  response_code      = 200
  response_page_path = "/index.html"
}

custom_error_response {
  error_code         = 404
  response_code      = 200
  response_page_path = "/index.html"
}

  origin {
    domain_name              = var.bucket_id
    origin_id                = "S3-${var.bucket_id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    target_origin_id       = "S3-${var.bucket_id}"
    viewer_protocol_policy = "redirect-to-https"

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]
    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "asklyticsbi-${var.environment}-cloudfront"
    Environment = var.environment
    Project     = "AskLyticsBI"
  }
}


data "aws_iam_policy_document" "s3_cloudfront" {
  statement {
    sid    = "AllowCloudFrontRead"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${var.bucket_arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values = [
        aws_cloudfront_distribution.frontend.arn
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = var.bucket_name
  policy = data.aws_iam_policy_document.s3_cloudfront.json
}
