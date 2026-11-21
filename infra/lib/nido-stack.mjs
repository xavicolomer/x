/* Nido on AWS, sized for proofs of concept: everything is pay per use, nothing runs or bills by the hour.
   CloudFront serves the app (S3), uploaded pictures and models (/_blob/*, S3) and the API (/api/*, HTTP API + Lambda),
   all from one address, so the browser needs no CORS for the API. DynamoDB is on-demand. Cognito Lite handles sign-in. */
import { Stack, Duration, RemovalPolicy, CfnOutput, Fn } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export class NidoStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const ctx = (k, d) => this.node.tryGetContext(k) ?? d;
    // PoC default: `cdk destroy` removes everything, data included. Pass -c keepData=true to keep the table and uploads.
    const keep = String(ctx('keepData', 'false')) === 'true';
    const removal = keep ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // ----- data: one on-demand table -----
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,      // no provisioned capacity: pay per read and write
      removalPolicy: removal,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // ----- files: the app, and uploaded pictures and 3D models -----
    const bucketProps = { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, removalPolicy: removal, autoDeleteObjects: !keep };
    const site = new s3.Bucket(this, 'Site', { ...bucketProps, removalPolicy: RemovalPolicy.DESTROY, autoDeleteObjects: true });
    const uploads = new s3.Bucket(this, 'Uploads', {
      ...bucketProps,
      // the browser posts files straight here with a short-lived signed policy from the API
      cors: [{ allowedMethods: [s3.HttpMethods.POST], allowedOrigins: ['*'], allowedHeaders: ['*'], maxAge: 3000 }],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(1) }],
    });

    // ----- API: one small ARM Lambda behind an HTTP API (the cheaper API Gateway type) -----
    const fn = new NodejsFunction(this, 'ApiFn', {
      entry: join(here, '..', 'lambda', 'api.mjs'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: { TABLE: table.tableName, BUCKET: uploads.bucketName },
      bundling: { minify: true, target: 'node22', sourceMap: false, externalModules: [] },   // bundle the SDK too: no surprises from the runtime's copy
      logGroup: new logs.LogGroup(this, 'ApiLogs', { retention: logs.RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY }),
    });
    table.grantReadWriteData(fn);
    uploads.grantPut(fn);

    const api = new apigw.HttpApi(this, 'Api', { createDefaultStage: false });
    new apigw.HttpStage(this, 'Stage', { httpApi: api, stageName: '$default', autoDeploy: true,
      throttle: { rateLimit: Number(ctx('rateLimit', 10)), burstLimit: Number(ctx('burstLimit', 20)) } });   // caps runaway costs

    // ----- delivery: CloudFront in front of everything (cheapest price class: Europe and North America) -----
    const apiDomain = Fn.select(2, Fn.split('/', api.apiEndpoint));
    const dist = new cf.Distribution(this, 'Cdn', {
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      defaultRootObject: 'index.html',
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      defaultBehavior: { origin: origins.S3BucketOrigin.withOriginAccessControl(site), viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED, compress: true },
      additionalBehaviors: {
        '/_blob/*': { origin: origins.S3BucketOrigin.withOriginAccessControl(uploads), viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED },          // uploads never change: their names are random ids
        '/api/*': { origin: new origins.HttpOrigin(apiDomain), viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL, cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER },
      },
    });
    const siteUrl = `https://${dist.distributionDomainName}`;

    // ----- sign-in: Cognito Lite (free allowance of monthly users), its hosted sign-in page, code flow with PKCE -----
    const pool = new cognito.UserPool(this, 'Users', {
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { fullname: { required: false, mutable: true } },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: removal,
    });
    const domain = pool.addDomain('Login', { cognitoDomain: { domainPrefix: ctx('authDomainPrefix', `nido-${this.account}`) } });
    const devOrigins = String(ctx('devOrigins', '')).split(',').filter(Boolean);       // e.g. -c devOrigins=http://localhost:8080
    const client = pool.addClient('Web', {
      generateSecret: false,
      preventUserExistenceErrors: true,
      authFlows: { userSrp: true },
      oAuth: { flows: { authorizationCodeGrant: true }, scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`${siteUrl}/`, ...devOrigins.map(o => `${o}/`)], logoutUrls: [`${siteUrl}/`, ...devOrigins.map(o => `${o}/`)] },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      idTokenValidity: Duration.hours(1), accessTokenValidity: Duration.hours(1), refreshTokenValidity: Duration.days(30),
    });
    new cognito.CfnUserPoolGroup(this, 'Admins', { userPoolId: pool.userPoolId, groupName: 'admins', description: 'Can take any home out of Explore' });

    // ----- routes: public reads, signed-in writes -----
    const integration = new HttpLambdaIntegration('ApiIntegration', fn);
    const authorizer = new HttpJwtAuthorizer('Jwt', `https://cognito-idp.${this.region}.amazonaws.com/${pool.userPoolId}`, { jwtAudience: [client.userPoolClientId] });
    const route = (method, path, auth) => api.addRoutes({ path, methods: [method], integration, ...(auth ? { authorizer } : {}) });
    const M = apigw.HttpMethod;
    route(M.GET, '/api/homes'); route(M.GET, '/api/homes/{owner}/{id}'); route(M.GET, '/api/shops');
    route(M.PUT, '/api/homes/{id}', true); route(M.DELETE, '/api/homes/{owner}/{id}', true);
    route(M.GET, '/api/me/drafts', true); route(M.PUT, '/api/me/drafts/{id}', true); route(M.DELETE, '/api/me/drafts/{id}', true);
    route(M.PUT, '/api/shops/me', true); route(M.POST, '/api/uploads', true);

    // ----- the app itself, plus the config it reads to find the API and sign-in -----
    new s3deploy.BucketDeployment(this, 'DeploySite', {
      destinationBucket: site,
      sources: [s3deploy.Source.asset(join(here, '..', '..', 'dist', 'web')),
        s3deploy.Source.jsonData('config.json', { apiBase: '/api', region: this.region, userPoolId: pool.userPoolId, clientId: client.userPoolClientId, authDomain: domain.baseUrl() })],
      distribution: dist, distributionPaths: ['/*'],
    });

    // ----- optional: an email when spending passes a small monthly amount (budgets themselves are free) -----
    const budgetEmail = ctx('budgetEmail', '');
    if (budgetEmail) new budgets.CfnBudget(this, 'Budget', {
      budget: { budgetName: 'nido-poc', budgetType: 'COST', timeUnit: 'MONTHLY', budgetLimit: { amount: Number(ctx('budgetUsd', 5)), unit: 'USD' } },
      notificationsWithSubscribers: [50, 100].map(threshold => ({
        notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold, thresholdType: 'PERCENTAGE' },
        subscribers: [{ subscriptionType: 'EMAIL', address: budgetEmail }] })),
    });

    new CfnOutput(this, 'SiteUrl', { value: siteUrl, description: 'Open Nido here' });
    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId, description: 'Add yourself to its "admins" group to moderate Explore' });
    new CfnOutput(this, 'SignInUrl', { value: domain.baseUrl() });
  }
}
