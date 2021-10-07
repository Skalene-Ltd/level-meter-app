const regression = require('regression');

const differentiatePolynomial = coefficients => coefficients
  .flat() // copy array because reverse() mutates
  .reverse()
  .map((element, index) => index * element)
  .reverse()
  .slice(0, -1);

const solveQuadratic = coefficients => {
  const [a, b, c] = coefficients;
  if (a) {
    return [
      (-b + Math.sqrt(b**2 - 4*a*c)) / (2*a),
      (-b - Math.sqrt(b**2 - 4*a*c)) / (2*a)
    ].filter(Number.isFinite);
  } else if (b) {
    return [-c / b]
  } else {
    return []
  }
};

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
  
  if (raw.length !== 32768) {
    return { statusCode: 400, body: "array in request body wasn't 2048 long" };
  }

  /* there are eight channels. each will be an array of 4096 values.
  ** reshape the raw array from a 1-dimensional, 32768-long array, to
  ** a 2d, 8 x 4096 array */
  let channels = Array(8).fill([]);
  for (let i = 0; i < 8; i++) {
    channels[i] = raw.filter((_element, index) => (index % 8) === i );
  }

  /* for each channel, convert the array of values to a 2d array of
  ** [[0, value], [1, value] ... ] */
  const channelPoints = channels.map(values =>
    values.map((element, index) => [index, element -0])
  );

  // get the mean value of each channel, to use later
  const channelMeans = channelPoints.map(channel =>
    channel.reduce(
      (previous, current) => previous + current[1],
      0
    ) / channel.length
  );

  /* remove all leading and trailing zeroes and then remove any points
  ** that are below the mean. this means we only get the peak */
  const channelPointsOfInterest = channelPoints.map((points, index) => points
    .filter((last => v => last = last || v[1])(false))
    // and strip off trailing zeroes
    .reverse()
    .filter((last => v => last = last || v[1])(false))
    .reverse()
    .filter(point => point[1] > channelMeans[index])
  );

  /* the remove all values until the first non-zero value. ie remove
  ** leading zeroes. also strip trailing zeroes the same way */
  const cubics = channelPointsOfInterest.map(values => 
    regression.polynomial(
      values,
      { order: 3 }
    ).equation
  );

  const derivativeCoefficients = cubics.map(differentiatePolynomial);

  const maxima = derivativeCoefficients.map(derivative => {
    const solutions = solveQuadratic(derivative);

    const secondDerivativeCoefficients = differentiatePolynomial(derivative);
    const [m, c] = secondDerivativeCoefficients; // y = mx + c
    const secondDerivative = x => (m*x) + c;

    return solutions.filter(solution =>
      Math.sign(secondDerivative(solution)) === -1
    )[0];
  });

  return { statusCode: 200, body: JSON.stringify(maxima) };
};
