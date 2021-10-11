const lib = require('../../netlify/functions/lib');

test('creates correct points from array of numbers', () => {
  const input = [5, 7, 2, 3];
  expect(lib.generatePointsAt10msIntervals(input)).toEqual([
    [0,  5],
    [10, 7],
    [20, 2],
    [30, 3]
  ]);
});
