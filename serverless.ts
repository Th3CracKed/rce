import type { AWS } from '@serverless/typescript';

import rce from '@functions/rce';

const serverlessConfiguration: AWS = {
  service: 'rce-sls',
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
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      region: '${opt:region, self:custom.ext.region}',
    },
    lambdaHashingVersion: '20201221',
  },
  // import the function via paths
  functions: { rce },
};

module.exports = serverlessConfiguration;
