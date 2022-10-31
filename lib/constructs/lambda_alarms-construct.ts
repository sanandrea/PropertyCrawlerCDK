import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function } from "aws-cdk-lib/aws-lambda";
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwa from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sub from 'aws-cdk-lib/aws-sns-subscriptions';
import { IAlarmRule } from 'aws-cdk-lib/aws-cloudwatch';

/**
 * Properties for a LambdaAlarm
 */
export interface LambdaAlarmsProps {
    /**
     * Array of Lambdas that will be monitored
     */
    readonly lambdaFunctions: Array<Function>;

    /**
     * The emails to which the alarm-triggered notification will be sent.
     */
    readonly emails: Array<string>;
}

export class LambdaAlarms extends Construct {
    constructor(scope: Construct, id: string, props: LambdaAlarmsProps) {
        super(scope, id);

        if (props.emails.length === 0) {
            throw new Error(
                'Cannot supply an empty array of email subscriptions',
            );
        }

        const lambdaAlarmTopic: sns.ITopic = new sns.Topic(this, 'Topic', {
            topicName: 'LambdaErrorAlarm'
        });

        props.emails.forEach((email: string) => {
            lambdaAlarmTopic.addSubscription(
                new sub.EmailSubscription(email),
            );
        });

        const alarmAction: cwa.SnsAction = new cwa.SnsAction(lambdaAlarmTopic);
        
        let allAlarmsArray: IAlarmRule[] = [];
        props.lambdaFunctions.forEach(lambdaFun => {
            allAlarmsArray.push(this.createAlarmsForLambda(lambdaFun))
        });
        
        const lambdaAlarmRule = cloudwatch.AlarmRule.anyOf(
            ...allAlarmsArray
        ); 
        const lambdaUmbrellaAlarm = new cloudwatch.CompositeAlarm(this, 'LambdaCompositeAlarm', {
            compositeAlarmName: 'Crawler-Lambda-Umbrella-alarm',
            alarmRule: lambdaAlarmRule
        });
        lambdaUmbrellaAlarm.addAlarmAction(alarmAction);
    }

    private createAlarmsForLambda(lambdaFunction: Function): cloudwatch.IAlarmRule {
        // Lambda Error Metric 📊
        const functionErrors = lambdaFunction.metricErrors({
            period: Duration.minutes(1),
        });
    
        // Lambda Latency Metric 📊
        const functionDuration = lambdaFunction.metricDuration({
            period: Duration.minutes(1)
        });
    
        // Lambda Error Alarm 🔔
        const lambdaErrorAlarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}-errors-alarm`, {
            alarmName: `${lambdaFunction.functionName}-error-alarm`,
            metric: functionErrors,
            threshold: 1,
            comparisonOperator:
                cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            alarmDescription:
                'Alarm if the SUM of Errors is greater than or equal to the threshold (1) for 1 evaluation period',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
    
        // Lambda Latency Alarm 🔔
        const lambdaLatencyAlarm = new cloudwatch.Alarm(this, `${lambdaFunction.node.id}-latency-alarm`, {
            alarmName: `${lambdaFunction.functionName}-latency-alarm`,
            metric: functionDuration,
            threshold: 240000, // in ms = 4 mins = 80% of Lambda timeout
            comparisonOperator:
                cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            alarmDescription:
                'Alarm if the Duration of the Lambda is greater than or equal to the 80% of the Timeout',
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING
        });
    
        const alarmRule = cloudwatch.AlarmRule.anyOf(
            lambdaErrorAlarm,
            lambdaLatencyAlarm
        );
        return alarmRule;
    }
}

