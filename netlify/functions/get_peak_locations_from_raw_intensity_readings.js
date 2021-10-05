const regression = require('regression');

exports.handler = async function(event, _context) {
  let raw;
  try {
    raw = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "request body wasn't an array" };
  }

  if (!raw instanceof Array) {
    return { statusCode: 400, body: "request body wasn't an array" };
  }
  
  if (!raw.length === 2048) {
    return { statusCode: 400, body: "array in request body wasn't 2048 long" };
  }

  /* there are eight channels. each will be an array of 256 values.
  ** reshape the raw array from a 1-dimensional, 2048-long array, to
  ** a 2d, 8 x 256 array */
  let channels = Array(8).fill([]);
  for (let i = 0; i < 8; i++) {
    channels[i] = raw.filter((_element, index) => (index % 8) === i );
  }

  const results = channels.map(values => {
    const data = values.map((element, index) => [index, element]);
    return regression.polynomial(data, { order: 3 }).string;
  });

  return { statusCode: 200, body: JSON.stringify(results) };
};
