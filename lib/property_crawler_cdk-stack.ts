import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Function, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as assets from "aws-cdk-lib/aws-s3-assets";
import { resolve } from 'path';

export class PropertyCrawlerCdkStack extends Stack {
  public lambdaAsset: assets.Asset;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.lambdaAsset = new assets.Asset(this, "LambdaAssetsZip", {
      path: resolve(__dirname, "../../PropertyCrawlerLambda/dist/property-crawler-0.0.1.zip"),
    });

    const crawler = new Function(this, "CrawlerFunction", {
      runtime: Runtime.PYTHON_3_8,
      code: Code.fromBucket(
        this.lambdaAsset.bucket,
        this.lambdaAsset.s3ObjectKey
        ),
      handler: 'lambda_handlers.crawler.lambda_handler'
    });
  }
}
