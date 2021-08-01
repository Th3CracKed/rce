import type { AWS } from '@serverless/typescript';

import rce from '@functions/rce';

const serverlessConfiguration: AWS = {
  service: 'rce-sls2',
  frameworkVersion: '2',
  custom: {
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true,
    },
    region: '${opt:region, self:provider.region}',
  },
  plugins: ['serverless-webpack', 'serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs14.x',
    region: 'eu-west-3',
    timeout: 30,
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      region: '${opt:region, self:provider.region}',
    },
    lambdaHashingVersion: '20201221',
    iamRoleStatements: [
      {
        Effect: "Allow",
        Action: [
          "iam:PassRole",
        ],
        Resource: "*",
      },
      {
        Effect: "Allow",
        Action: [
          "dynamodb:Get*",
          "dynamodb:Delete*",
        ],
        Resource: "*",
      },
      {
        Effect: "Allow",
        Action: [
          "s3:Get*",
          "s3:List*"
        ],
        Resource: "arn:aws:s3:::rce2021",
      },
      {
        Effect: "Allow",
        Action: [
          "lambda:GetLayerVersion",
        ],
        Resource: "arn:aws:lambda:eu-west-3:340383546424:layer:logs_extension:*",
      },
      {
        Effect: "Allow",
        Action: [
          "lambda:CreateFunction",
          "lambda:InvokeFunction",
          "lambda:DeleteFunction",
        ],
        Resource: "*",
      },
    ],
  },
  // import the function via paths
  functions: { rce },
};

module.exports = serverlessConfiguration;
