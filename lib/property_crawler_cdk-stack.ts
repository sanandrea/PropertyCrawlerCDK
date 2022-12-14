import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Function, Code, Runtime } from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb"
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as assets from "aws-cdk-lib/aws-s3-assets";
import { resolve } from 'path';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { BillingAlarm } from './constructs/billing_alarm-stack';
import * as constants from './config/constants'
import { LambdaAlarms } from './constructs/lambda_alarms-construct';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class PropertyCrawlerCdkStack extends Stack {
  public lambdaAsset: assets.Asset;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.lambdaAsset = new assets.Asset(this, "LambdaAssetsZip", {
      path: resolve(__dirname, "../../PropertyCrawlerLambda/dist/property-crawler-0.0.1.zip"),
    });

    const lambdaRole = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for the Crawler Lambda',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
      ]
    });
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'PropertiesList',
      partitionKey: { name: 'pr_id', type: dynamodb.AttributeType.STRING },
      sortKey: {name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED // Customer managed costs 1$ per month.
    });

    // Index GSI 🗂
    table.addGlobalSecondaryIndex({
      indexName: 'titleIndex',
      partitionKey: {name: 'title', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'addedTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    
    // Index GSI 🗂
    table.addGlobalSecondaryIndex({
      indexName: 'timeAdded',
      partitionKey: {name: 'sk', type: dynamodb.AttributeType.STRING},
      sortKey: {name: 'addedTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const propertyStoreBucket = new s3.Bucket(this, 's3-bucket', {
      bucketName: 'property-crawler-storage',
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: true,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    propertyStoreBucket.grantReadWrite(new iam.AccountRootPrincipal());

    const crawler = new Function(this, "CrawlerFunction", {
      runtime: Runtime.PYTHON_3_8,
      functionName: 'PropertyCrawler',
      memorySize: 1024,
      timeout: Duration.minutes(5),
      role: lambdaRole,
      code: Code.fromBucket(
        this.lambdaAsset.bucket,
        this.lambdaAsset.s3ObjectKey
        ),
      handler: 'dpcie.crawler_handler',
      environment: {
        CRAWLER_TABLE_NAME: table.tableName
      },
    });

    const statusCheckerFunction = new Function(this, "StatusCheckerFunction", {
      runtime: Runtime.PYTHON_3_8,
      functionName: 'PropertyStatusChecker',
      memorySize: 1024,
      timeout: Duration.minutes(5),
      role: lambdaRole,
      code: Code.fromBucket(
        this.lambdaAsset.bucket,
        this.lambdaAsset.s3ObjectKey
        ),
      handler: 'dpcie.status_checker_handler',
      environment: {
        CRAWLER_TABLE_NAME: table.tableName,
        PROPERTY_BUCKET_NAME: propertyStoreBucket.bucketName
      },
    });
    propertyStoreBucket.grantReadWrite(statusCheckerFunction);

    const dlq = new sqs.Queue(this, 'Queue', {
      queueName: 'CrawlerDLQ'
    });

    const lambdaCrawlerTarget = new LambdaFunction(crawler, {
      deadLetterQueue:dlq,
      retryAttempts: 2
    });

    const lambdaCheckerTarget = new LambdaFunction(statusCheckerFunction, {
      deadLetterQueue:dlq,
      retryAttempts: 2
    });

    new Rule(this, 'CrawlerTriggerRule', {
      ruleName: 'MainCrawlerTrigger',
      schedule: Schedule.cron({ minute: '0', hour: '00,12' }),
      targets: [lambdaCrawlerTarget],
    });

    new Rule(this, 'StatusCheckerRule', {
      ruleName: 'StatusCheckerTrigger',
      schedule: Schedule.cron({ minute: '15', hour: '00,12' }),
      targets: [lambdaCheckerTarget],
    });

    new BillingAlarm(this, 'AWSAccountBillingAlarm', {
      monthlyThreshold: 5,
      emails: [constants.EMAIL_ADDRESS],
    });

    new LambdaAlarms(this, 'PropertyCrawlerLambdaAlarms', {
      emails: [constants.EMAIL_ADDRESS],
      lambdaFunctions: [crawler, statusCheckerFunction]
    })
  }
}
