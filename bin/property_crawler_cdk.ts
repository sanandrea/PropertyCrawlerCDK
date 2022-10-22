#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PropertyCrawlerCdkStack } from '../lib/property_crawler_cdk-stack';

const app = new cdk.App();
new PropertyCrawlerCdkStack(app, 'PropertyCrawlerCdkStack');
