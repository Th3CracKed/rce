import 'source-map-support/register';

import { middyfy } from '@libs/lambda';
import { IS_ONLINE, region } from '@libs/environements';

import Lambda from 'aws-sdk/clients/lambda';
import archiver from 'archiver';
import fs from 'fs';
import { formatErrorJSONResponse, formatJSONResponse } from '@libs/apiGateway';

const lambda = new Lambda({ region, httpOptions: { timeout: 360000 } });

const rce = async (event) => {
  console.log('Event is :');
  console.log(event.body.code);
  // check event validity ==> contains code 
  const buffer = await createZipFile(event);
  const functionName = 'randomString';
  const params: Lambda.Types.CreateFunctionRequest = {
    FunctionName: functionName,
    Role: 'arn:aws:iam::340383546424:role/service-role/hello-role-edm0rxo6', // TODO create role
    Code: {
      ZipFile: buffer
    },
    Runtime: "nodejs14.x",
    Handler: 'index.handler'
  };
  // TODO IAM ROLE TO CREATE/INVOKE/DELETE FUNCTION

  await createFunction(params);

  try {
    const result = await invokeFunction(params.FunctionName);
    deleteFunction(params.FunctionName);
    return formatJSONResponse({
      result
    });
  } catch (error) {
    return formatErrorJSONResponse({
      error
    });
  }

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

function createZipFile(event: any) {
  return new Promise<Buffer>((resolve, reject) => {
    const zipPath = IS_ONLINE ? '/tmp/example.zip' : 'tmp/example.zip';
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip');
    archive.pipe(output);
    const { lang = 'js', code: userCode } = event.body;
    // TODO wrapper needs to adapt with lang
    const wrappedCode = `exports.handler = async (event) => {
      ${userCode}
    };`
    archive.append(wrappedCode, { name: 'index.' + lang });
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


export const main = middyfy(rce);

