const regression = require('regression');

exports.generatePointsAt10msIntervals = values =>
  values.map((element, index) => [0.01 * index, element - 0]);

exports.differentiatePolynomial = coefficients => coefficients
  .flat() // copy array because reverse() mutates
  .reverse()
  .map((element, index) => index * element)
  .reverse()
  .slice(0, -1);

exports.solveQuadratic = coefficients => {
  const [a, b, c] = coefficients;
  if (a) {
    return [
      (-b + Math.sqrt(b**2 - 4*a*c)) / (2*a),
      (-b - Math.sqrt(b**2 - 4*a*c)) / (2*a)
    ].filter(Number.isFinite);
  } else if (b) {
    return [-c / b];
  } else {
    return [];
  }
};

exports.stripLeadingZeroPoints = points => points
  .filter((last => v => last = last || v[1])(false))

exports.stripTrailingZeroPoints = points => points
  .slice() // shallow copy array
  .reverse()
  .filter((last => v => last = last || v[1])(false))
  .reverse();

exports.fitCubic = points => regression
  .polynomial(points, { order: 3, precision: 12 });

exports.filterPointsGreaterThanMean = points => {
  const mean = (
    points.reduce((previous, current) => previous + current[1], 0)
    / points.length
  );
  return points.filter(point => point[1] > mean);
};

exports.getLinearFunctionFromCoefficients = coefficients => {
  const [m, c] = coefficients;
  return x => (m*x) + c;
};
