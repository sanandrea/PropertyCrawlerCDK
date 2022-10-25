# Property Crawler
This project contains the CDK components to deploy a simple property crawler.

The crawler does a search in a predefined area of Ireland. The search result is then stored in an AWS DDB table.
The table has enabled versioning so price changes are recorded with historical values.

## High Level

This package contains only the CDK components in Typescript. The Lambda code is located in the other *sister package* [PropertyCrawlerLambda](https://github.com/sanandrea/PropertyCrawlerLambda)


### Deploying

```
cdk deploy
```


### Guidelines
You should explore the contents of this project. It demonstrates a CDK app with an instance of a stack (`PropertyCrawlerCdkStack`)
which contains an Amazon SQS queue that is subscribed to an Amazon SNS topic.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
