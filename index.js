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
  this.geofence = config.geofence || 300;
  this.refresh = config.refresh * 1000 || 10000;    // Convert to ms
  this.manufacturer = config.manufacturer;
  this.model = config.model;
  this.serial = config.serial;

  // Empty array for storing people data
  this.database = [];
  this.sensorState = [];
  this.sensorStatus = [];
  this.occupancyService = [];

  // Initial state of anyone occupancy sensor
  this.anyoneSensorState = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

  for (var i = 0; i < this.people.length; i++) {

    // Initial state and status for single person occupancy sensor
    this.sensorState.push(Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED);
    this.sensorStatus.push(2);

    // Database for oauth signature
    var data = new openpaths({
      key: this.people[i].access,
      secret: this.people[i].secret
    });
    this.database.push(data);

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
    this.log(this.people[person].name + " is" + (this.sensorState[person] ? "" : " not") + " present.");
    callback(null, this.sensorState[person]);
  },

  // Method to return status active of single person occupancy sensor
  getStatusActive: function(person, callback) {
    callback(null, (this.sensorStatus[person] & 2) == 2);
  },

  // Method to return status fault of single person occupancy sensor
  getStatusFault: function(person, callback) {
    callback(null, this.sensorStatus[person] & 1);
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
      if ((this.sensorStatus[i] & 2) == 2) statusActive = true;
    }
    callback(null, statusActive);
  },

  // Method to return status fault of anyone occupancy sensor
  getAnyoneStatusFault: function(callback) {
    var statusFault = 0;
    for (var i = 0; i < this.sensorStatus.length; i++) {
      if (this.sensorStatus[i] & 1) statusFault = 1;
    }
    callback(null, statusFault);
  },

  periodicUpdate: function() {

    // Backup previous state for change detection
    var prevState = this.anyoneSensorState;
    this.anyoneSensorState = Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;

    for (var i = 0; i < this.people.length; i++) {

      // Check presence of each persion
      this.getLocation(this.database[i], i);

      // Determine if anyone is presence
      if (this.sensorState[i] == Characteristic.OccupancyDetected.OCCUPANCY_DETECTED) {
        this.anyoneSensorState = Characteristic.OccupancyDetected.OCCUPANCY_DETECTED;
      }
    }

    // Detect for change in anyone state
    if (this.anyoneSensorState != prevState) {
        this.occupancyService[this.occupancyService.length - 2].getCharacteristic(Characteristic.OccupancyDetected).setValue(this.anyoneSensorState);
        this.log((this.anyoneSensorState ? "Someone" : "No one") + " is present.");
    }

    setTimeout(this.periodicUpdate.bind(this), this.refresh);
  },

  getLocation: function(data, person) {
    var params = {num_points: 1};   // Only get the latest point
    var RADIUS = 20902231.68        // Radius of the Earth in ft
    var that = this;

    data.getPoints(params, function(error, response, points) {
      var current = JSON.parse(points)[0];
      if (current) {

        // Calculate distance between coordinates
        var fromLat = current.lat * Math.PI / 180;
        var fromLon = current.lon * Math.PI / 180
        var dLat = that.toLat - fromLat;
        var dLon = that.toLon - fromLon;
        var a = Math.pow(Math.sin(dLat / 2), 2) + (Math.pow(Math.sin(dLon / 2), 2) * Math.cos(fromLat) * Math.cos(that.toLat));
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var distance = RADIUS * c;

        // Detect for change in state
        if (that.sensorState[person] != ((distance < that.geofence) ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED)) {
          that.sensorState[person] = (distance < that.geofence) ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
          that.occupancyService[person].getCharacteristic(Characteristic.OccupancyDetected).setValue(that.sensorState[person]);
          that.log(that.people[person].name + " is " + (that.sensorState[person] ? "" : "not") + " present.");
        }

        that.sensorStatus[person] = (that.sensorStatus[person] & 1) | 2;    // Active status
      } else {
        that.sensorStatus[person] = (that.sensorStatus[person] & 1) | 0;    // Inactive status
      }

      // Error detection
      if (error) {
        that.sensorStatus[person] = (that.sensorStatus[person] & 2) | 1;    // Fault status
      } else {
        that.sensorStatus[person] = (that.sensorStatus[person] & 2) | 0;    // Normal status
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

    // Create Accessory Informaton Service
    var informationService = new Service.AccessoryInformation();
    if (this.manufacturer) informationService.setCharacteristic(Characteristic.Manufacturer, this.manufacturer);
    if (this.model) informationService.setCharacteristic(Characteristic.Model, this.model);
    if (this.serial) informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);

    this.occupancyService.push(informationService);

    // Start retrieving info from server
    this.periodicUpdate();

    // Get initial state
    for (var i = 0; i <= this.people.length; i++) {
      this.occupancyService[i].getCharacteristic(Characteristic.OccupancyDetected).getValue();
      this.occupancyService[i].getCharacteristic(Characteristic.StatusActive).getValue();
      this.occupancyService[i].getCharacteristic(Characteristic.StatusFault).getValue();
    }

    return this.occupancyService;
  }
};
