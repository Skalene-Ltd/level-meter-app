const fs = require('fs');
const path = require('path');
const endpoint = require('../../netlify/functions/get_peak_locations_from_raw_intensity_readings').handler;

test('gets correct maximum for a known curve', async () => {
  const rawData = fs.readFileSync(
    path.join(__dirname, 'sample.csv'),
    { encoding: 'utf-8' }
  )
    .split('\r\n')
    .map(line => line.split(','))
    .flat()
    .slice(0, -1);
  const payload = JSON.stringify(rawData);
  const response = await endpoint({ body: payload });
  const result = JSON.parse(response.body);
  expect(result[0]).toBeGreaterThan(2500);
  expect(result[0]).toBeLessThan(3000);
});
