(function(global){
  "use strict";

  const textDecoder = new TextDecoder("utf-8");

  class ProtobufReader {
    constructor(bytes){
      this.bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this.position = 0;
    }

    get eof(){
      return this.position >= this.bytes.length;
    }

    readTag(){
      if (this.eof) {
        return null;
      }
      const tag = this.readVarint();
      const fieldNumber = Number(tag >> 3n);
      const wireType = Number(tag & 7n);
      if (fieldNumber === 0) {
        throw new Error("不正なProtocol Buffersフィールドです");
      }
      return { fieldNumber, wireType };
    }

    readVarint(){
      let value = 0n;
      let shift = 0n;
      for (let i = 0; i < 10; i++) {
        this.ensureAvailable(1);
        const byte = this.bytes[this.position++];
        value |= BigInt(byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) {
          return value;
        }
        shift += 7n;
      }
      throw new Error("Protocol Buffersのvarintが長すぎます");
    }

    readNumber(){
      return Number(this.readVarint());
    }

    readInt32(){
      return Number(BigInt.asIntN(32, this.readVarint()));
    }

    readBoolean(){
      return this.readVarint() !== 0n;
    }

    readBytes(){
      const length = this.readLength();
      this.ensureAvailable(length);
      const result = this.bytes.subarray(this.position, this.position + length);
      this.position += length;
      return result;
    }

    readString(){
      return textDecoder.decode(this.readBytes());
    }

    readFloat(){
      this.ensureAvailable(4);
      const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.position, 4);
      const value = view.getFloat32(0, true);
      this.position += 4;
      return value;
    }

    readDouble(){
      this.ensureAvailable(8);
      const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.position, 8);
      const value = view.getFloat64(0, true);
      this.position += 8;
      return value;
    }

    skipField(wireType){
      switch (wireType) {
        case 0:
          this.readVarint();
          return;
        case 1:
          this.skipBytes(8);
          return;
        case 2:
          this.skipBytes(this.readLength());
          return;
        case 5:
          this.skipBytes(4);
          return;
        default:
          throw new Error("未対応のProtocol Buffers wire typeです: " + wireType);
      }
    }

    readLength(){
      const length = Number(this.readVarint());
      if (!Number.isSafeInteger(length) || length < 0) {
        throw new Error("不正なProtocol Buffersデータ長です");
      }
      return length;
    }

    skipBytes(length){
      this.ensureAvailable(length);
      this.position += length;
    }

    ensureAvailable(length){
      if (length < 0 || this.position + length > this.bytes.length) {
        throw new Error("Protocol Buffersデータが途中で終了しています");
      }
    }
  }

  function decodeFeedMessage(input){
    const reader = new ProtobufReader(input);
    const feed = { header: {}, entities: [] };

    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        feed.header = decodeFeedHeader(reader.readBytes());
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        const entity = decodeFeedEntity(reader.readBytes());
        if (!entity.isDeleted && (entity.tripUpdate || entity.vehicle || entity.alert)) {
          feed.entities.push(entity);
        }
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return feed;
  }

  function decodeFeedHeader(bytes){
    const reader = new ProtobufReader(bytes);
    const header = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        header.gtfsRealtimeVersion = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 0) {
        header.incrementality = reader.readNumber();
      } else if (tag.fieldNumber === 3 && tag.wireType === 0) {
        header.timestamp = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return header;
  }

  function decodeFeedEntity(bytes){
    const reader = new ProtobufReader(bytes);
    const entity = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        entity.id = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 0) {
        entity.isDeleted = reader.readBoolean();
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        entity.tripUpdate = decodeTripUpdate(reader.readBytes());
      } else if (tag.fieldNumber === 4 && tag.wireType === 2) {
        entity.vehicle = decodeVehiclePosition(reader.readBytes());
      } else if (tag.fieldNumber === 5 && tag.wireType === 2) {
        entity.alert = decodeAlert(reader.readBytes());
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return entity;
  }

  function decodeVehiclePosition(bytes){
    const reader = new ProtobufReader(bytes);
    const vehiclePosition = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        vehiclePosition.trip = decodeTripDescriptor(reader.readBytes());
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        vehiclePosition.position = decodePosition(reader.readBytes());
      } else if (tag.fieldNumber === 3 && tag.wireType === 0) {
        vehiclePosition.currentStopSequence = reader.readNumber();
      } else if (tag.fieldNumber === 4 && tag.wireType === 0) {
        vehiclePosition.currentStatus = reader.readNumber();
      } else if (tag.fieldNumber === 5 && tag.wireType === 0) {
        vehiclePosition.timestamp = reader.readNumber();
      } else if (tag.fieldNumber === 6 && tag.wireType === 0) {
        vehiclePosition.congestionLevel = reader.readNumber();
      } else if (tag.fieldNumber === 7 && tag.wireType === 2) {
        vehiclePosition.stopId = reader.readString();
      } else if (tag.fieldNumber === 8 && tag.wireType === 2) {
        vehiclePosition.vehicle = decodeVehicleDescriptor(reader.readBytes());
      } else if (tag.fieldNumber === 9 && tag.wireType === 0) {
        vehiclePosition.occupancyStatus = reader.readNumber();
      } else if (tag.fieldNumber === 10 && tag.wireType === 0) {
        vehiclePosition.occupancyPercentage = reader.readNumber();
      } else if (tag.fieldNumber === 11 && tag.wireType === 2) {
        if (!vehiclePosition.multiCarriageDetails) {
          vehiclePosition.multiCarriageDetails = [];
        }
        vehiclePosition.multiCarriageDetails.push(decodeCarriageDetails(reader.readBytes()));
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return vehiclePosition;
  }

  function decodeTripUpdate(bytes){
    const reader = new ProtobufReader(bytes);
    const tripUpdate = { stopTimeUpdates: [] };
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        tripUpdate.trip = decodeTripDescriptor(reader.readBytes());
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        tripUpdate.stopTimeUpdates.push(decodeStopTimeUpdate(reader.readBytes()));
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        tripUpdate.vehicle = decodeVehicleDescriptor(reader.readBytes());
      } else if (tag.fieldNumber === 4 && tag.wireType === 0) {
        tripUpdate.timestamp = reader.readNumber();
      } else if (tag.fieldNumber === 5 && tag.wireType === 0) {
        tripUpdate.delay = reader.readInt32();
      } else if (tag.fieldNumber === 6 && tag.wireType === 2) {
        tripUpdate.tripProperties = decodeTripProperties(reader.readBytes());
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return tripUpdate;
  }

  function decodeStopTimeUpdate(bytes){
    const reader = new ProtobufReader(bytes);
    const stopTimeUpdate = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 0) {
        stopTimeUpdate.stopSequence = reader.readNumber();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        stopTimeUpdate.arrival = decodeStopTimeEvent(reader.readBytes());
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        stopTimeUpdate.departure = decodeStopTimeEvent(reader.readBytes());
      } else if (tag.fieldNumber === 4 && tag.wireType === 2) {
        stopTimeUpdate.stopId = reader.readString();
      } else if (tag.fieldNumber === 5 && tag.wireType === 0) {
        stopTimeUpdate.scheduleRelationship = reader.readNumber();
      } else if (tag.fieldNumber === 6 && tag.wireType === 2) {
        stopTimeUpdate.stopTimeProperties = decodeStopTimeProperties(reader.readBytes());
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return stopTimeUpdate;
  }

  function decodeStopTimeEvent(bytes){
    const reader = new ProtobufReader(bytes);
    const event = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 0) {
        event.delay = reader.readInt32();
      } else if (tag.fieldNumber === 2 && tag.wireType === 0) {
        event.time = reader.readNumber();
      } else if (tag.fieldNumber === 3 && tag.wireType === 0) {
        event.uncertainty = reader.readInt32();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return event;
  }

  function decodeStopTimeProperties(bytes){
    const reader = new ProtobufReader(bytes);
    const properties = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        properties.assignedStopId = reader.readString();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return properties;
  }

  function decodeTripProperties(bytes){
    const reader = new ProtobufReader(bytes);
    const properties = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        properties.tripId = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        properties.startDate = reader.readString();
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        properties.startTime = reader.readString();
      } else if (tag.fieldNumber === 4 && tag.wireType === 2) {
        properties.shapeId = reader.readString();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return properties;
  }

  function decodeAlert(bytes){
    const reader = new ProtobufReader(bytes);
    const alert = { activePeriods: [], informedEntities: [] };
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        alert.activePeriods.push(decodeTimeRange(reader.readBytes()));
      } else if (tag.fieldNumber === 5 && tag.wireType === 2) {
        alert.informedEntities.push(decodeEntitySelector(reader.readBytes()));
      } else if (tag.fieldNumber === 6 && tag.wireType === 0) {
        alert.cause = reader.readNumber();
      } else if (tag.fieldNumber === 7 && tag.wireType === 0) {
        alert.effect = reader.readNumber();
      } else if (tag.fieldNumber === 8 && tag.wireType === 2) {
        alert.url = decodeTranslatedString(reader.readBytes());
      } else if (tag.fieldNumber === 10 && tag.wireType === 2) {
        alert.headerText = decodeTranslatedString(reader.readBytes());
      } else if (tag.fieldNumber === 11 && tag.wireType === 2) {
        alert.descriptionText = decodeTranslatedString(reader.readBytes());
      } else if (tag.fieldNumber === 12 && tag.wireType === 2) {
        alert.ttsHeaderText = decodeTranslatedString(reader.readBytes());
      } else if (tag.fieldNumber === 13 && tag.wireType === 2) {
        alert.ttsDescriptionText = decodeTranslatedString(reader.readBytes());
      } else if (tag.fieldNumber === 14 && tag.wireType === 0) {
        alert.severityLevel = reader.readNumber();
      } else if (tag.fieldNumber === 16 && tag.wireType === 2) {
        alert.imageAlternativeText = decodeTranslatedString(reader.readBytes());
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return alert;
  }

  function decodeTimeRange(bytes){
    const reader = new ProtobufReader(bytes);
    const timeRange = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 0) {
        timeRange.start = reader.readNumber();
      } else if (tag.fieldNumber === 2 && tag.wireType === 0) {
        timeRange.end = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return timeRange;
  }

  function decodeEntitySelector(bytes){
    const reader = new ProtobufReader(bytes);
    const selector = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        selector.agencyId = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        selector.routeId = reader.readString();
      } else if (tag.fieldNumber === 3 && tag.wireType === 0) {
        selector.routeType = reader.readInt32();
      } else if (tag.fieldNumber === 4 && tag.wireType === 2) {
        selector.trip = decodeTripDescriptor(reader.readBytes());
      } else if (tag.fieldNumber === 5 && tag.wireType === 2) {
        selector.stopId = reader.readString();
      } else if (tag.fieldNumber === 6 && tag.wireType === 0) {
        selector.directionId = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return selector;
  }

  function decodeTranslatedString(bytes){
    const reader = new ProtobufReader(bytes);
    const translatedString = { translations: [] };
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        translatedString.translations.push(decodeTranslation(reader.readBytes()));
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return translatedString;
  }

  function decodeTranslation(bytes){
    const reader = new ProtobufReader(bytes);
    const translation = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        translation.text = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        translation.language = reader.readString();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return translation;
  }

  function decodeTripDescriptor(bytes){
    const reader = new ProtobufReader(bytes);
    const trip = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        trip.tripId = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        trip.startTime = reader.readString();
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        trip.startDate = reader.readString();
      } else if (tag.fieldNumber === 4 && tag.wireType === 0) {
        trip.scheduleRelationship = reader.readNumber();
      } else if (tag.fieldNumber === 5 && tag.wireType === 2) {
        trip.routeId = reader.readString();
      } else if (tag.fieldNumber === 6 && tag.wireType === 0) {
        trip.directionId = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return trip;
  }

  function decodePosition(bytes){
    const reader = new ProtobufReader(bytes);
    const position = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 5) {
        position.latitude = reader.readFloat();
      } else if (tag.fieldNumber === 2 && tag.wireType === 5) {
        position.longitude = reader.readFloat();
      } else if (tag.fieldNumber === 3 && tag.wireType === 5) {
        position.bearing = reader.readFloat();
      } else if (tag.fieldNumber === 4 && tag.wireType === 1) {
        position.odometer = reader.readDouble();
      } else if (tag.fieldNumber === 5 && tag.wireType === 5) {
        position.speed = reader.readFloat();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return position;
  }

  function decodeVehicleDescriptor(bytes){
    const reader = new ProtobufReader(bytes);
    const vehicle = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        vehicle.id = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        vehicle.label = reader.readString();
      } else if (tag.fieldNumber === 3 && tag.wireType === 2) {
        vehicle.licensePlate = reader.readString();
      } else if (tag.fieldNumber === 4 && tag.wireType === 0) {
        vehicle.wheelchairAccessible = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return vehicle;
  }

  function decodeCarriageDetails(bytes){
    const reader = new ProtobufReader(bytes);
    const carriage = {};
    while (!reader.eof) {
      const tag = reader.readTag();
      if (tag.fieldNumber === 1 && tag.wireType === 2) {
        carriage.id = reader.readString();
      } else if (tag.fieldNumber === 2 && tag.wireType === 2) {
        carriage.label = reader.readString();
      } else if (tag.fieldNumber === 3 && tag.wireType === 0) {
        carriage.occupancyStatus = reader.readNumber();
      } else if (tag.fieldNumber === 4 && tag.wireType === 0) {
        carriage.occupancyPercentage = reader.readNumber();
      } else if (tag.fieldNumber === 5 && tag.wireType === 0) {
        carriage.carriageSequence = reader.readNumber();
      } else {
        reader.skipField(tag.wireType);
      }
    }
    return carriage;
  }

  const api = { decodeFeedMessage };
  global.GtfsRealtimeDecoder = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
