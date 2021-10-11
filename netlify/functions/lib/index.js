const regression = require('regression');

exports.generatePointsAt10msIntervals = values =>
  values.map((element, index) => [index * 10, element - 0]);

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
  .polynomial(points, { order: 3 })
  .equation;
