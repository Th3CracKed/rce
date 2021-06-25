export const formatJSONResponse = (response: Record<string, unknown>) => {
  return {
    statusCode: 200,
    body: JSON.stringify(response)
  }
}

export const formatErrorJSONResponse = (response: Record<string, unknown> | string) => {
  return {
    statusCode: 400,
    body: response
  }
}

export const formatInternalErrorJSONResponse = (response: Record<string, unknown> | string) => {
  return {
    statusCode: 500,
    body: response
  }
}
