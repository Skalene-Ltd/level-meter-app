const regression = require('regression');

const differentiatePolynomial = coefficients => coefficients
  .reverse()
  .map((element, index) => index * element)
  .reverse()
  .slice(0, -1);

const solveQuadratic = coefficients => {
  const [a, b, c] = coefficients;
  return [
    (-b + Math.sqrt(b**2 - 4*a*c)) / (2*a),
    (-b - Math.sqrt(b**2 - 4*a*c)) / (2*a)
  ].filter(Number.isFinite);
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

  const cubics = channels.map(values => 
    regression.polynomial(
      values.map((element, index) =>
        [index, element]),
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
