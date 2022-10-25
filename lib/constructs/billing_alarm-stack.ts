import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwa from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sub from 'aws-cdk-lib/aws-sns-subscriptions';

/**
 * Properties for a BillingAlarm
 */
export interface BillingAlarmProps {
  /**
   * Monetary amount threshold in USD that represents the maximum exclusive
   * limit before which the alarm is triggered and the notification sent.
   */
  readonly monthlyThreshold: number;

  /**
   * The emails to which the alarm-triggered notification will be sent.
   */
  readonly emails: Array<string>;
}

export class BillingAlarm extends Construct {
    constructor(scope: Construct, id: string, props: BillingAlarmProps) {
      super(scope, id);
  
      if (props.emails.length === 0) {
        throw new Error(
          'Cannot supply an empty array of email subscriptions',
        );
      }
  
      const billingAlarmTopic: sns.ITopic = new sns.Topic(this, 'Topic');
  
      props.emails.forEach((email: string) => {
        billingAlarmTopic.addSubscription(
          new sub.EmailSubscription(email),
        );
      });
  
      const billingAlarmMetric: cw.Metric = new cw.Metric({
        metricName: 'EstimatedCharges',
        namespace: 'AWS/Billing',
        statistic: 'Maximum',
        dimensionsMap: {
          Currency: 'USD',
        },
      }).with({
        period: Duration.hours(2),
      });
  
      const billingAlarm: cw.Alarm = new cw.Alarm(
        this,
        'EstimatedChargesAlarm',
        {
          alarmDescription: 'Upper monthly billing cost limit',
          comparisonOperator:
            cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          evaluationPeriods: 1,
          metric: billingAlarmMetric,
          threshold: props.monthlyThreshold,
        },
      );
  
      const alarmAction: cwa.SnsAction = new cwa.SnsAction(billingAlarmTopic);
  
      billingAlarm.addAlarmAction(alarmAction);
    }
  }