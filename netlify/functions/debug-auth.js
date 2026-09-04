/* Retired diagnostic function. Netlify's manual "drop deploy" adds functions
   additively rather than fully replacing the set on each deploy, so simply
   omitting this file from a later deploy zip does not undeploy it -- it has
   to be overwritten in place with something inert instead. This function
   intentionally does nothing and reveals nothing. */
exports.handler = async () => ({ statusCode: 404, body: 'Not found' });
