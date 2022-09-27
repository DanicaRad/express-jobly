const { BadRequestError } = require("../expressError");

/** Sanitizes PATCH request body data for SQL UPDATE query.
 * 
 * Takes JSON from request body as first arg and object of JSON keys => db column names as second arg.
 * 
 * Returns object of SQL parameters and parameter values.
 * 
 * Throws error if no data.
 * 
 * Ex:
 * 
 * { "firstName": "updated first name" }, { firstName: 'first_name'} =>  
 * { setCols: "first_name"=$1, values: ['updated first name'] }
*/

function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);
  if (keys.length === 0) throw new BadRequestError("No data");

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map((colName, idx) =>
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };
