import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _storage = FlutterSecureStorage();

  Future<void> saveUser(String json) => _storage.write(key: 'user', value: json);
  Future<String?> readUser() => _storage.read(key: 'user');
  Future<void> clear() => _storage.deleteAll();
}
