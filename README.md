# homebridge-openpaths [![npm version](https://badge.fury.io/js/homebridge-openpaths.svg)](https://badge.fury.io/js/homebridge-openpaths)
<p>Presence Detection (OpenPaths) Plugin for <a href="https://github.com/nfarina/homebridge">HomeBridge</a></p>

<p>
Basics of how this plugin works:<br>
1. Retrieve the latest location record from `OpenPaths` server periodicly.<br>
2. Calculate distance between the latest location and the reference location.<br>
3. Determine if the distance is greater than the geofence setting.<br>
4. Update occupancy sensor state if there's a change.
</p>

# Installation
<p>
1. Register in <a href="https://openpaths.cc">OpenPaths</a>.<br>
2. Login and locate your `Access Key` and `Secret Key` in OpenPaths.<br>
3. Install homebridge using `npm install -g homebridge`.<br>
4. Install this plugin using `npm install -g homebridge-openpaths`.<br>
5. Update your configuration file. See configuration sample below.<br>
</p>

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

    "geofence": "300",
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
| geofence     | Size of reference location geofence in `ft` (Default 300ft).  | No       |
| refresh      | Interval to poll for user location in `s` (Default 10s).      | No       |
| manufacturer | The manufacturer of your device.                              | No       |
| model        | The model of your device.                                     | No       |
| serial       | The serial number of your device.                             | No       |
