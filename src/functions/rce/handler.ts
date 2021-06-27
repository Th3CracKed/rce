import 'source-map-support/register';

import { middyfy } from '@libs/lambda';
import { IS_ONLINE, region } from '@libs/environements';

import Lambda from 'aws-sdk/clients/lambda';
import archiver from 'archiver';
import fs from 'fs';
import { formatErrorJSONResponse, formatJSONResponse } from '@libs/apiGateway';
import { v4 as uuidv4 } from 'uuid';


const lambda = new Lambda({ region, httpOptions: { timeout: 360000 } });

const rce = async (event) => {
  console.log('Event is :');
  console.log(event.body.code);
  const { lang = 'js', code: userCode } = event.body;
  // TODO wrapper needs to adapt with lang
  const wrappedCode = `
  exports.handler = async (event, context) => {
  const logs = [];
  (function() {
    const exLog = console.log;
    console.log = function(msg) {
        logs.push(msg);
        exLog.apply(this, arguments);
    }
  })()
    userCode();
    return logs;
  };
  
  function userCode() {
    ${userCode}
  }
  `


  const buffer = await createZipFile('index.' + lang, wrappedCode);
  const params: Lambda.Types.CreateFunctionRequest = getParams(buffer);
  // TODO IAM ROLE TO CREATE/INVOKE/DELETE FUNCTION
  try {
    await createFunction(params);
    const result = await invokeFunction(params.FunctionName);
    return formatJSONResponse({
      result: JSON.parse(result)
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
    Role: 'arn:aws:iam::340383546424:role/service-role/hello-role-edm0rxo6',
    Code: {
      ZipFile: buffer
    },
    Runtime: "nodejs14.x",
    Handler: 'index.handler'
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


export const main = middyfy(rce);

