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
