# Get data from the device and analyse it with the raw data panel

The 'raw data' panel can be used to get data from the device and analyse it to find the peak light intensity.

> First, make sure the app is [connected to the device](../../#connect-to-the-device).

## Get raw data

To get raw data from the device, click the 'retrieve raw data' button in the raw data panel.

Wait for the data to be transferred from the device.
This process is shown by a progress bar.

## Download raw data in a spreadsheet-compatible format

When the data is ready, a file should appear in the panel.
Click the 'download' button to download the data.
The file will be a `csv` file, so you can open it in a spreadsheet application.

## Analyse the data

The app can automatically analyse the data to find:

- the time in milliseconds when the light peaked in intensity
- the equation that describes the rate of change of light intensity

When data has been retrieved, the 'analyse' button should become enabled.
Click the 'analyse' button to start the analysis.
When the analysis is complete, the results should be available at the bottom of the 'raw data' panel.

### Results

The results should be shown in a grid.
Channels 1 - 4 are in the top row, ordered left to right, and channels 5 - 8 are in the bottom row, ordered left to right.

For each channel, the results should include a time in milliseconds and an equation.

The time is how long after the `START` command the peak intensity of light was measured.

The equation describes and approximation of the rate of change of intensity as a function of time, where time is measured in seconds after the `START` command.

If there were no conclusive results for a channel, that channel's results will say 'inconclusive'.
