<!--
title: Serverless AWS Documentation
menuText: AWS Documentation
layout: Doc
-->

# Serverless AWS Documentation

Check out the [Getting started guide](../../01-guide/) and the [CLI reference](../../03-cli-reference/) for an introduction to Serverless.

## Setup and configuration

Please follow these [setup instructions](./01-setup.md) to start using AWS Lambda and serverless together

## Provider configuration

Following are examples and descriptions of all available AWS specific provider configuration settings.

```yaml
provider:
  name: aws # Set the provider you want to use, in this case AWS
  runtime: nodejs4.3 # Default runtime for functions in this provider
  stage: dev # Set the default stage used. Default is dev
  region: us-east-1 # Overwrite the default region used. Default is us-east-1
  deploymentBucket: com.serverless.${self:provider.region}.deploys # Overwrite the default deployment bucket
  stackTags: # Optional CF stack tags
   key: value
  stackPolicy: # Optional CF stack policy. The example below allows updates to all resources except deleting/replacing EC2 instances (use with caution!)
    - Effect: Allow
      Principal: "*"
      Action: "Update:*"
      Resource: "*"
    - Effect: Deny
      Principal: "*"
      Action:
        - Update:Replace
        - Update:Delete
      Condition:
        StringEquals:
          ResourceType:
            - AWS::EC2::Instance
```

### Deployment S3 Bucket
The bucket must exist beforehand and be in the same region as the Lambda functions you want to deploy. Due to the importance and hard dependency of the deployment bucket, if you want to switch between the core and custom bucket, you have to do the following:

* **From CloudFormation Bucket to Self Provided Bucket:** You need to manually empty the CloudFormation bucket. On the next deployment the bucket will be removed and we will use the self provided bucket. Without emptying the CloudFormation bucket your next deployment will fail.

* **From Self Provided Bucket to CloudFormation Bucket:** You'll need to add the following custom resources template to `serverless.yml`:

```yml
resources:
  Resources:
    ServerlessDeploymentBucket:
      Type: AWS::S3::Bucket
```
then deploy your service to create the CloudFormation bucket, then remove the `provider.deploymentBucket` property and deploy your service again. This syncs the framework back to the CloudFormation Bucket without conflict. After that deployment you can remove the CloudFormation bucket from the resources section in `serverless.yml` as it will be automatically added from now on.

## Additional function configuration

```yaml
functions:
  hello:
    name: ${self:provider.stage}-lambdaName # Deployed Lambda name
    description: Description of what the lambda function does # Description to publish to AWS
    handler: handler.hello # handler set in AWS Lambda
    runtime: python2.7 # optional overwrite, default is provider runtime
    memorySize: 512 # optional, default is 1024
    timeout: 10 # optional, default is 6
```

## General Configuration
* [Configuring IAM resources](./02-iam.md)
* [VPC configuration](./03-vpc.md)
* [Cloudformation Resource naming reference](./04-resource-names-reference.md)

## AWS events

* [API Gateway](./events/01-apigateway.md)
* [S3](./events/02-s3.md)
* [Schedule](./events/03-schedule.md)
* [SNS](./events/04-sns.md)
* [Kinesis Streams](./events/05-kinesis-streams.md)
* [Dynamodb Streams](./events/06-dynamodb-streams.md)

## Examples

See the [examples folder](./examples) for all AWS serverless examples

- [hello-world](./examples/hello-world)
- [using-external-libraries](./examples/using-external-libraries)
- [web-api](./examples/web-api)

To add examples, fork this repo and submit a pull request
