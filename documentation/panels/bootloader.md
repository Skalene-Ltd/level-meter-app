# Update firmware with the bootloader panel

The bootloader panel can be used to update the firmware on the device by connecting to the device's bootloader.

1. First, make sure the app is [connected to the device](../../#connect-to-the-device).
1. Then, drag and drop a bootloader file into the blue zone labelled 'Drag and drop a file here'. Your file should appear in the bootloader panel, and the 'program' button should become enabled.
1. Click the 'program' button to overwrite the firmware with your file.

## Advanced

The app will first send the `BTLDR_MODE` command to the device to put the device in bootloader mode. If the device is already in bootloader mode, this will fail. 

To skip the `BTLDR_MODE` command, hold the shift key while you click the 'program' button.
