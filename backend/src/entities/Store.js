class Store {
  constructor({ id, code, name, timezone, isActive, emails, createdAt }) {
    this.id = id;
    this.code = code;
    this.name = name;
    this.timezone = timezone || 'UTC';
    this.isActive = isActive;
    this.emails = emails || ''; // Guardamos el string original
    this.createdAt = createdAt;
  }

  // Método útil para obtener los emails como una lista limpia
  getEmailList() {
    if (!this.emails) return [];
    return this.emails.split(',').map(email => email.trim()).filter(e => e !== '');
  }

  getStatus() { return this.isActive ? 'ACTIVE' : 'INACTIVE'; }
  getDisplayName() { return `${this.code} - ${this.name}`; }
}

module.exports = Store;