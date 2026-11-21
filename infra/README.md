# Nido on AWS

A proof-of-concept setup where everything is paid per use. Nothing runs, or bills, by the hour.

| Piece | Service | Why it stays cheap |
| --- | --- | --- |
| The app | S3 + CloudFront (cheapest price class: Europe and North America) | One 1.4 MB file, cached at the edge. CloudFront has a permanent free allowance. |
| Data | DynamoDB, one table, on-demand | Pay per read and write, no capacity reserved. Point-in-time backups are off. |
| API | HTTP API (the cheaper API Gateway type) + one Lambda on ARM, 256 MB | Pay per request. Throttled to 10 requests a second (bursts of 20) so a bug or a bot can't run up a bill. |
| Pictures and 3D models | S3, uploaded straight from the browser, served through CloudFront at `/_blob/` | At most 10 MB per file. |
| Sign-in | Cognito, Lite plan, its hosted sign-in page | Free allowance of monthly users. |
| Logs | CloudWatch | Kept for one week. |
| IKEA catalogue | Bundled in the Lambda | Stores nothing, needs no seeding. |

There's no VPC, NAT gateway, custom domain or WAF; each of those costs money every month whether it's used or not. With a handful of testers, the whole thing typically costs well under a dollar a month, mostly within AWS's free allowances. Check current prices for your region before relying on that.

## Deploy

You need Node.js 20 or newer and an AWS account with the AWS CLI set up (`aws configure`). Choose a region in your profile: Ireland (`eu-west-1`) has every service used here.

```bash
# from the project root: build the app
npm install
npm run build

# then the infrastructure
cd infra
npm install
npx cdk bootstrap                                  # once per account and region
npx cdk deploy -c budgetEmail=you@example.com      # optional: an email at 50% and 100% of $5 a month
```

The deploy prints `SiteUrl`: open it and sign up. To moderate Explore (take anyone's home out of it), add yourself to the `admins` group:

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId from the output> --username you@example.com --group-name admins
```

After changing the app, `npm run deploy` (in `infra/`) rebuilds and uploads it.

Options, passed as `-c name=value`:

| Name | Default | What it does |
| --- | --- | --- |
| `budgetEmail` | none | Sends a budget alert to this address |
| `budgetUsd` | `5` | Monthly amount for the budget alert |
| `keepData` | `false` | `true` keeps the table, user pool and uploads when the stack is destroyed |
| `rateLimit`, `burstLimit` | `10`, `20` | API requests per second |
| `authDomainPrefix` | `nido-<account id>` | Prefix of the Cognito sign-in page address (must be unique worldwide) |
| `devOrigins` | none | Extra addresses allowed to sign in, e.g. `http://localhost:8080` |

## Remove it

```bash
npx cdk destroy
```

This deletes everything, homes and uploads included, unless you deployed with `-c keepData=true`.

## Develop without AWS

```bash
npm run dev        # http://localhost:8080, or the next free port if 8080 is taken (it prints the address)
npm test           # API tests
```

The dev server runs the real API code against an in-memory table (saved in `dev/.data.json`), stores uploads in memory, and replaces Cognito with a name prompt. Sign in as `dev-admin` to act as an admin.

## Data layout

One table, keys `PK` and `SK`, and one index `GSI1`:

| PK | SK | What | GSI1 |
| --- | --- | --- | --- |
| `USER#<sub>` | `DRAFT#<id>` | A person's private draft home | |
| `USER#<sub>` | `HOME#<id>` | A published home and its summary | `PUBLISHED` / time, newest first |
| `SHOP#<sub>` | `SHOP` | A shop and its products | `SHOPS` / id |

Homes and shops are stored as JSON text. The app checks and cleans everything it reads, and the API limits each document to 350 KB.
