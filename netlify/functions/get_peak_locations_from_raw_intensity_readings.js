const lib = require('./lib');

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

  const results = channels.map(channel => {
    const points = lib.generatePointsAt10msIntervals(channel);

    const dataPoints = lib.stripLeadingZeroPoints(
      lib.stripTrailingZeroPoints(points)
    );

    const peakPoints = lib.filterPointsGreaterThanMean(dataPoints);

    const { equation, r2 } = lib.fitCubic(peakPoints);

    if (r2 < 0.8) {
      return null;
    }

    const differentialCoefficients = lib.differentiatePolynomial(equation);
    const secondDifferentialCoefficients = lib.differentiatePolynomial(differentialCoefficients);
    const secondDifferential = lib.getLinearFunctionFromCoefficients(secondDifferentialCoefficients);

    const solutions = lib.solveQuadratic(differentialCoefficients);
    const maxima = solutions.filter(solution => secondDifferential(solution) < 0);

    // there should be 1 or 0 maxima
    if (maxima.length) {
      return Math.round(maxima[0] * 1000); // convert seconds to ms
    } else {
      return null;
    }
  });

  return { statusCode: 200, body: JSON.stringify(results) };
};
