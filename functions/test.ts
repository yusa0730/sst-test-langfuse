export const handler = (event, context, callback) => {
  console.log(process.env.PRIVATE_KEY);

  return {
    status: 200,
    body: process.env.PRIVATE_KEY
  };
};









