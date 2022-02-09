import 'source-map-support/register';

import { middyfy } from '@libs/lambda';
import { IS_ONLINE, region } from '@libs/environements';

import Lambda from 'aws-sdk/clients/lambda';
import archiver from 'archiver';
import fs from 'fs';
import { formatErrorJSONResponse, formatJSONResponse } from '@libs/apiGateway';
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';

const lambda = new Lambda({ region, httpOptions: { timeout: 360000 } });

const rce = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('Event is :');
  console.log(event.body.code);
  const { lang = 'js', code: lambdaCode } = event.body;

  const buffer = await createZipFile('index.' + lang, lambdaCode);
  const params: Lambda.Types.CreateFunctionRequest = getParams(buffer);
  try {
    await createFunction(params);
    await invokeFunction(params.FunctionName);
    console.log('Getting Logs...');
    const logs = await getLog(params.FunctionName, region);
    console.log('logs', logs);
    deleteLog(params.FunctionName, region);
    return formatJSONResponse({
      result: logs
    });
  } catch (error) {
    return formatErrorJSONResponse({
      error
    });
  } finally {
    deleteFunction(params.FunctionName);
  }

}


function getParams(buffer: Buffer): Lambda.CreateFunctionRequest {
  return {
    FunctionName: uuidv4(),
    Role: 'arn:aws:iam::340383546424:role/service-role/hello_logs-role-bulpcu1p',
    Code: {
      ZipFile: buffer
    },
    Runtime: "nodejs14.x",
    Handler: 'index.handler',
    Layers: ['arn:aws:lambda:eu-west-3:340383546424:layer:logs_extension:27'],
    Environment: {
      Variables: {
        LOGS_S3_BUCKET_NAME: 'rce2021'
      }
    }
  };
}

function createFunction(params: Lambda.CreateFunctionRequest) {
  return new Promise<void>((resolve, reject) => {
    lambda.createFunction(params, function (err, data) {
      console.log('createFunction callback');
      if (err) {
        console.log('createFunction callback err');
        console.log(err, err.stack);
        reject(JSON.stringify(err));
      } else {
        console.log(data);
        resolve();
      }
    });
  });
}

async function invokeFunction(functionName: string) {
  return new Promise<string>((resolve, reject) => {
    lambda.invoke({ FunctionName: functionName, Payload: '' }, function (err, data) {
      console.log('lambda invoked');
      if (err) {
        console.log(err, err.stack);
        reject(JSON.stringify(err));
      } else {
        if (data.StatusCode !== 200 || data.FunctionError === 'null') {
          const errorObject = JSON.stringify(data);
          console.error(errorObject);
          reject(errorObject);
        }
        console.log(data.Payload);
        resolve(data.Payload.toString());
      }
    });
  });
}

function deleteFunction(functionName: string) {
  return new Promise<boolean>((resolve, reject) => {
    lambda.deleteFunction({ FunctionName: functionName }, function (err) {
      if (err) {
        console.log(err, err.stack);
        reject(JSON.stringify(err));
      } else {
        console.log(`Lambda ${functionName} deleted`);
        resolve(true);
      }
    });
  });
}

function createZipFile(fileName: string, code: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const zipPath = IS_ONLINE ? '/tmp/example.zip' : 'tmp/example.zip';
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');
    archive.pipe(output);
    archive.append(code, { name: fileName }); // TODO needs to be adapted to multi lang
    const buffer = [];
    archive
      .on('data', (data => buffer.push(data)))
      .on('finish', () => {
        return resolve(Buffer.concat(buffer));
      })
      .on('error', reject);
    archive.finalize();
    return archive;
  });
}

function getLog(id: string, region: string) {
  return new Promise<string>((resolve) => {
    const dynamoDbClient = new AWS.DynamoDB.DocumentClient({ region });
    dynamoDbClient.get({
      TableName: 'logs',
      Key: {
        id
      }
    }, async (err, data) => {
      console.log('data', data);
      if (data?.Item?.log) {
        resolve(data.Item.log);
        return;
      } else if (err) {
        console.error(err);
      }
      const logs = await getLog(id, region);
      resolve(logs);
    });
  });
}

function deleteLog(id: string, region: string) {
  return new Promise((resolve, reject) => {
    const dynamoDbClient = new AWS.DynamoDB.DocumentClient({ region });
    dynamoDbClient.delete({
      TableName: 'logs',
      Key: {
        id
      }
    }, (err, data) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      console.log('data', data);
      resolve(data);
    });
  });
}

export const main = middyfy(rce);
