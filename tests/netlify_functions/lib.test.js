const lib = require('../../netlify/functions/lib');

describe('generatePointsAt10msIntervals', () => {
  test('creates correct points from array of numbers', () => {
    const input = [5, 7, 2, 3];
    expect(lib.generatePointsAt10msIntervals(input)).toEqual([
      [0, 5],
      [10, 7],
      [20, 2],
      [30, 3]
    ]);
  });
  
  test('creates correct points from array of base-ten strings', () => {
    const input = ['8', '1', '10', '03', '17'];
    expect(lib.generatePointsAt10msIntervals(input)).toEqual([
      [0, 8],
      [10, 1],
      [20, 10],
      [30, 3],
      [40, 17]
    ]);
  });
});

describe('differentiatePolynomial', () => {
  test('differentiates simple cubic', () => {
    // x^3 + x^2 + x + 1
    const input = [1, 1, 1, 1];
    expect(lib.differentiatePolynomial(input))
      .toEqual([3, 2, 1]);
  });

  test('differentiates another cubic', () => {
    // 5x^3 + 0x^2 + 3x + 0
    const input = [5, 0, 3, 0];
    expect(lib.differentiatePolynomial(input))
      .toEqual([15, 0, 3]);
  });

  test('differentiates a quadratic', () => {
    // 2.3x^2 - 2x + 8
    const input = [2.3, -2, 8];
    expect(lib.differentiatePolynomial(input))
      .toEqual([4.6, -2]);
  });
});

describe('solveQuadratic', () => {
  test('solves a quadratic', () => {
    // x^2 - 3x - 8
    const input = [1, -3, -8];
    const result = lib.solveQuadratic(input).sort() // don't care about order;
    const expectedResult = [-1.7016, 4.7016];
    result.forEach((value, index) => {
      expect(value).toBeCloseTo(expectedResult[index]);
    });
  });

  test('solves a straight line', () => {
    // 0x^2 + 2x - 7
    const input = [0, 2, -7];
    const result = lib.solveQuadratic(input);
    // should be only one root;
    expect(result.length).toBe(1);
    // result should be 3.5
    expect(result[0]).toBeCloseTo(3.5);
  });
});

describe('stripLeadingZeroPoints', () => {
  test('leaves an array with no zeroes untouched', () => {
    const input = [
      [0, 5],
      [10, 0],
      [20, 8]
    ];
    expect(lib.stripLeadingZeroPoints(input))
      .toEqual(input);
  });

  test('strips three leading zeroes', () => {
    const input = [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 17],
      [40, 0]
    ];
    expect(lib.stripLeadingZeroPoints(input))
      .toEqual([
        [30, 17],
        [40, 0]
      ]);
  });
});

describe('stripTrailingZeroPoints', () => {
  test('leaves an array with no trailing zeroes untouched', () => {
    const input = [
      [0, 0],
      [10, 15],
      [20, 0],
      [30, 57]
    ];
    expect(lib.stripTrailingZeroPoints(input))
      .toEqual(input);
  });

  test('strips a trailing zero', () => {
    const input = [
      [0, 0],
      [10, 15],
      [20, 0],
      [30, 57],
      [40, 0]
    ];
    expect(lib.stripTrailingZeroPoints(input))
      .toEqual([
        [0, 0],
        [10, 15],
        [20, 0],
        [30, 57]
      ]);
  });
});

describe('fitCubic', () => {
  test('fits a known cubic', () => {
    // -0.0006x^3 + 0.0292x^2 + 0.3353x + 4.881
    const points = [
      [0, 4.881],
      [10, 10.554],
      [20, 18.467],
      [30, 25.02],
      [40, 26.613]
    ];
    const result = lib.fitCubic(points);
    result.forEach((coefficient, index) => {
      expect(coefficient).toBeCloseTo(
        [-0.0006, 0.0292, 0.3353, 4.881][index],
        4 // high precision
      );
    });
  });
});

describe('filterPointsGreaterThanMean', () => {
  test('removes the correct points', () => {
    const input = [
      [0, 12],
      [10, 100],
      [20, 52.354],
      [30, 7.3478],
      [40, 43.2]
    ];
    const results = lib.filterPointsGreaterThanMean(input);
    const expectedResult = [
      [10, 100],
      [20, 52.354],
      [40, 43.2]
    ];
    expect(results.length).toBe(expectedResult.length);
    results.forEach((result, index) => {
      expect(result[0]).toBe(expectedResult[index][0]);
      expect(result[1]).toBeCloseTo(expectedResult[index][1]);
    });
  });
});

describe('getLinearFunctionFromCoefficients', () => {
  test('creates linear function y = x', () => {
    const coefficients = [1, 0];
    const result = lib.getLinearFunctionFromCoefficients(coefficients);
    expect(result(0)).toBe(0);
    expect(result(8)).toBe(8);
    expect(result(-23.4)).toBeCloseTo(-23.4);
  });
});
