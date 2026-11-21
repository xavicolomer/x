#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { NidoStack } from '../lib/nido-stack.mjs';

const app = new App();
new NidoStack(app, app.node.tryGetContext('stackName') || 'Nido', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  description: 'Nido Rooms proof of concept: pay-per-use (CloudFront, S3, HTTP API, Lambda, DynamoDB on-demand, Cognito Lite)',
});
