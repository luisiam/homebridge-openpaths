var Service, Characteristic;
var openpaths = require("openpaths-api");

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-openpaths", "OpenPaths", OpenPathsAccessory);
}

function OpenPathsAccessory(log, config){

  // Retrieve existing config
  this.log = log;
  this.name = config.name;
  this.people = config.people;
  this.toLat = config.latitude * Math.PI / 180;     // Convert to radian
  this.toLon = config.longitude * Math.PI / 180;    // Convert to radian
  this.geofence = config.geofence || 500;
  this.refresh = config.refresh * 1000 || 10000;    // Convert to ms
  this.manufacturer = config.manufacturer;
  this.model = config.model;
  this.serial = config.serial;

  // Empty array for storing people data
  this.database = [];
  this.distance = [];
  this.sensorState = [];
  this.sensorStatus = [];
  this.occupancyService = [];

  // Initial state of anyone occupancy sensor
  this.anyoneSensorState = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

  for (var i = 0; i < this.people.length; i++) {

    // Initial state and status for single person occupancy sensor
    this.sensorState.push(Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
    this.sensorStatus.push(1);

    // Database for oauth signature
    var data = new openpaths({
      key: this.people[i].access,
      secret: this.people[i].secret
    });
    this.database.push(data);
    this.distance.push(this.geofence * 2);

    // Occupancy sensor for each person
    var personService = new Service.OccupancySensor(this.people[i].name, this.people[i].name);
    personService.getCharacteristic(Characteristic.OccupancyDetected)
      .on("get", this.getState.bind(this, i));
    personService.getCharacteristic(Characteristic.StatusActive)
      .on("get", this.getStatusActive.bind(this, i));
    personService.getCharacteristic(Characteristic.StatusFault)
      .on("get", this.getStatusFault.bind(this, i));
    this.occupancyService.push(personService);
  }

  // Occupancy sensor for anyone
  var anyoneService = new Service.OccupancySensor("Anyone", "Anyone");
  anyoneService.getCharacteristic(Characteristic.OccupancyDetected)
    .on("get", this.getAnyoneState.bind(this));
  anyoneService.getCharacteristic(Characteristic.StatusActive)
    .on("get", this.getAnyoneStatusActive.bind(this));
  anyoneService.getCharacteristic(Characteristic.StatusFault)
    .on("get", this.getAnyoneStatusFault.bind(this));
  this.occupancyService.push(anyoneService);
}

OpenPathsAccessory.prototype = {

  // Method to return presence of single person occupancy sensor
  getState: function(person, callback) {
    // Log only if status is active and normal
    if (this.sensorStatus[person] == 2) {
      this.log(this.people[person].name + " is" + (this.sensorState[person] ? "" : " not") + " present. " + this.distance[person].toFixed(2) + " ft away.");
    }
    callback(null, this.sensorState[person]);
  },

  // Method to return status active of single person occupancy sensor
  getStatusActive: function(person, callback) {
    var statusActive = ((this.sensorStatus[person] & 2) == 2);
    var statusFault = this.sensorStatus[person] & 1;
    if (!statusActive && !statusFault) {
      this.log(this.people[person].name + "'s location is unavailable.");
    }
    callback(null, statusActive);
  },

  // Method to return status fault of single person occupancy sensor
  getStatusFault: function(person, callback) {
    var statusFault = this.sensorStatus[person] & 1;
    if (statusFault) {
      this.log("Error getting " + this.people[person].name + "'s location.");
    }
    callback(null, statusFault);
  },

  // Method to return presence of anyone occupancy sensor
  getAnyoneState: function(callback) {
    this.log((this.anyoneSensorState ? "Someone" : "No one") + " is present.");
    callback(null, this.anyoneSensorState);
  },

  // Method to return status active of anyone occupancy sensor
  getAnyoneStatusActive: function(callback) {
    var statusActive = false;
    for (var i = 0; i < this.sensorStatus.length; i++) {
      if ((this.sensorStatus[i] & 2) == 2) {
        statusActive = true;
      }
    }
    callback(null, statusActive);
  },

  // Method to return status fault of anyone occupancy sensor
  getAnyoneStatusFault: function(callback) {
    var statusFault = 0;
    for (var i = 0; i < this.sensorStatus.length; i++) {
      if (this.sensorStatus[i] & 1) {
        statusFault = 1;
      }
    }
    callback(null, statusFault);
  },

  periodicUpdate: function() {
    var that = this;

    // Check current state of each person
    for (var i = 0; i < this.people.length; i++) {
      this.getLocation(this.database[i], i);
    }

    // Try to wait for getLocation to complete
    setTimeout(function() {
      var currAnyoneState = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

      // Determine current anyone state
      for (var j = 0; j < that.people.length; j++) {
        if (that.sensorState[j] == Characteristic.OccupancyDetected.OCCUPANCY_DETECTED) {
          currAnyoneState = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED;
        }
      }

      // Detect for changes in anyone state
      if (that.anyoneSensorState != currAnyoneState) {
        that.anyoneSensorState = currAnyoneState;
        that.occupancyService[that.occupancyService.length - 2].getCharacteristic(Characteristic.OccupancyDetected).setValue(currAnyoneState);
        that.log((currAnyoneState ? "Someone" : "No one") + " is present.");
      }
    }, 2000);

    setTimeout(this.periodicUpdate.bind(this), this.refresh);
  },

  getLocation: function(data, person) {
    var params = {num_points: 3};   // Retrieve the latest points
    var RADIUS = 20902231           // Radius of the Earth in ft
    var that = this;

    data.getPoints(params, function(error, response, points) {
      if (points != "[]" && !error && response.statusCode == 200) {
        try {
          var current = JSON.parse(points);
          current = current[current.length - 1];

          // Calculate distance between coordinates
          var fromLat = current.lat * Math.PI / 180;
          var fromLon = current.lon * Math.PI / 180
          var dLat = that.toLat - fromLat;
          var dLon = that.toLon - fromLon;
          var a = Math.pow(Math.sin(dLat / 2), 2) + (Math.pow(Math.sin(dLon / 2), 2) * Math.cos(fromLat) * Math.cos(that.toLat));
          var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          that.distance[person] = RADIUS * c;
        } catch (error) {
          that.log(error);
        }

        // Determine current state
        var currState;
        if (that.distance[person] < that.geofence) {
          currState = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED;
        } else {
          currState = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
        }

        // Detect for changes in state
        if (that.sensorState[person] != currState) {
          that.sensorState[person] = currState;
          that.occupancyService[person].getCharacteristic(Characteristic.OccupancyDetected).setValue(currState);
          that.log(that.people[person].name + " is" + (currState ? "" : " not") + " present. " + that.distance[person].toFixed(2) + " ft away.");
        }

        // Set active and normal status
        that.sensorStatus[person] = 2;
      } else {

        // Set inactive and normal status
        that.sensorStatus[person] = 0;

        // Set fault status if there's an error
        if (error || response.statusCode != 200) {
          that.sensorStatus[person] = (that.sensorStatus[person] & 2) | 1;
        }
      }
    });
  },

  // Method to respond identify request
  identify: function(callback) {
    this.log("Identify requested!");
    callback();
  },

  // Method to return existing services
  getServices: function() {
    var that = this;

    // Create Accessory Informaton Service
    var informationService = new Service.AccessoryInformation();
    if (this.manufacturer) informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer);
    if (this.model) informationService.setCharacteristic(Characteristic.Model, this.model);
    if (this.serial) informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.occupancyService.push(informationService);

    // Start retrieving info from server
    this.periodicUpdate();

    return this.occupancyService;
  }
};
