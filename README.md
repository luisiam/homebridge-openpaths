# homebridge-openpaths [![npm version](https://badge.fury.io/js/homebridge-openpaths.svg)](https://badge.fury.io/js/homebridge-openpaths)
Presence Detection (OpenPaths) Plugin for [HomeBridge](https://github.com/nfarina/homebridge)

Basics of how this plugin works:<br>
1. Retrieve the latest location record from `OpenPaths` server periodicly.<br>
2. Calculate distance between the latest location and the reference location.<br>
3. Determine if the distance is greater than the geofence setting.<br>
4. Update occupancy sensor state if there's a change.<br>

# Installation
1. Register in [OpenPaths](https://openpaths.cc).
2. Login and locate your `Access Key` and `Secret Key` in OpenPaths.
3. Install the OpenPaths app ([iOS](https://itunes.apple.com/app/openpaths/id493605283)/[Android](https://play.google.com/store/apps/details?id=com.nytco.rnd.OpenPaths)).
4. Login and start collecting location data using your phone.
5. Install homebridge using `npm install -g homebridge`.
6. Install this plugin using `npm install -g homebridge-openpaths`.
7. Update your configuration file. See configuration sample below.

# Configuration
Edit your `config.json` accordingly. Configuration sample:
 ```
"accessories": [{
    "accessory": "OpenPaths",
    "name" : "OpenPaths",
    "people": [{
        "name": "Person 1",
        "access": "Access Key for Person 1",
        "secret": "Secret Key for Person 1"
    }, {
        "name": "Person 2",
        "access": "Access Key for Person 2",
        "secret": "Secret Key for Person 2"
    }],
    "latitude": "37.2972061",
    "longitude": "-121.957494",

    "geofence": "500",
    "refresh": "10",
    "manufacturer": "Manufacturer",
    "model": "Model",
    "serial": "Serial Number"
}]
```

| Fields       | Description                                                   | Required |
|--------------|---------------------------------------------------------------|----------|
| accessory    | Must always be `OpenPaths`.                                   | Yes      |
| name         | The name of your device.                                      | Yes      |
| people       | Array of OpenPaths accounts for presence detection.           | Yes      |
| latitude     | Latitude of reference location for presence detection.        | Yes      |
| longitude    | Longitude of reference location for presence detection.       | Yes      |
| geofence     | Size of reference location geofence in `ft` (Default 500ft).  | No       |
| refresh      | Interval to poll for user location in `s` (Default 10s).      | No       |
| manufacturer | The manufacturer of your device.                              | No       |
| model        | The model of your device.                                     | No       |
| serial       | The serial number of your device.                             | No       |
