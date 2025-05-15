const basicAuth = true;
const basicAuthUser = "ishizawa";
const basicAuthPassword = "test123";

const authString = `Basic ${Buffer.from(`${basicAuthUser}:${basicAuthPassword}`).toString("base64")}`;
// inline Lambda
export const handler = (event, context, callback) => {
  console.log("Event: ", JSON.stringify(event)); // ログ追加
  console.log("Context: ", JSON.stringify(context)); // ログ追加
  // Get request and request headers
  const request = event.Records[0].cf.request;
  const headers = request.headers;
  console.log("request.uri: ", request.uri);
  
  if (
    basicAuth &&
    (typeof headers.authorization === "undefined" ||
      headers.authorization[0].value !== authString)
  ) {
    const body = "Unauthorized";
    const response = {
      status: "401",
      statusDescription: "Unauthorized",
      body: body,
      headers: {
        "www-authenticate": [{ key: "WWW-Authenticate", value: "Basic" }],
      },
    };
    callback(null, response);
  }

  console.log("Modified Request Headers: ", JSON.stringify(request.headers)); // 追加

  console.log(
    "request.headers.host: ",
    JSON.stringify(request.headers.host[0].value),
  );
  // IMPORTANT: This is required for the Remix SSR to work correctly
  // if (request.headers.host.length && request.headers.host[0].value) {
  //   request.headers["x-forwarded-host"] = request.headers.host;
  // }

  console.log("request.headers: ", JSON.stringify(request.headers));

  // Continue request processing if authentication passed
  callback(null, request);
};









