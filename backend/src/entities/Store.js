class Store {
  constructor({
    id,
    code,
    name,
    timezone,
    isActive,
    createdAt
  }) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.timezone = timezone;
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  // Business logic methods
  isOperational() {
    return this.isActive === true;
  }

  getDisplayName() {
    return `${this.code} - ${this.name}`;
  }
}

module.exports = Store;